"""외부 날씨 비교 API (PRD 3.3)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Tenant
from ..schemas import WeatherCompareOut
from ..services import weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


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
