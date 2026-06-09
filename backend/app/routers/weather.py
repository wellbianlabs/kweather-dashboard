"""외부 날씨 비교 API (PRD 3.3)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Tenant
from ..schemas import CurrentWeatherOut, WeatherCompareOut
from ..services import weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/past-debug")
def past_debug(device_sn: str, date: str, tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)):
    """임시 진단: 과거 1년자료(w4/cbko) 라이브 응답 확인."""
    import httpx as _hx

    from ..config import settings
    from ..models import Device
    from ..services import geocode as geo

    dev = db.get(Device, device_sn)
    if dev is None or dev.tenant_id != tenant.id:
        raise HTTPException(404, "기기 없음")
    code = (dev.region_code if (dev.region_code and str(dev.region_code).isdigit()) else None) \
        or geo.region_code(dev.latitude, dev.longitude)
    out = {"device": device_sn, "lat": dev.latitude, "lon": dev.longitude, "dong_code": code, "key_set": bool(settings.KW_API_KEY)}
    if code:
        try:
            r = _hx.get(f"{settings.KW_PAST_BASE_URL}/cbko/{code}",
                        params={"startdate": date, "enddate": date, "api_key": settings.KW_API_KEY}, timeout=12)
            out["w4_status"] = r.status_code
            out["w4_body"] = r.text[:500]
        except Exception as e:  # noqa: BLE001
            out["w4_error"] = repr(e)
    return out


@router.get("/current", response_model=CurrentWeatherOut)
def current(
    device_sn: str,
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    try:
        return weather.current_external(db, tenant, device_sn)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/compare", response_model=WeatherCompareOut)
def compare(
    device_sn: str,
    start: datetime | None = None,
    end: datetime | None = None,
    interval: int = Query(30, ge=1, le=120),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    try:
        return weather.compare(db, tenant, device_sn, start, end, interval)
    except ValueError as e:
        raise HTTPException(404, str(e))
