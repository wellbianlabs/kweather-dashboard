"""케이웨더 IoT 단말기 실시간 측정값 동기화 API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_tenant
from ..models import Tenant
from ..services import kw_iot

router = APIRouter(prefix="/api/kweather", tags=["kweather-iot"])


@router.get("/status")
def status(tenant: Tenant = Depends(get_tenant)):
    return {
        "configured": bool(settings.KW_IOT_API_KEY and settings.KW_IOT_USER_ID),
        "base_url": settings.KW_IOT_BASE_URL,
        "user_id_set": bool(settings.KW_IOT_USER_ID),
    }


@router.post("/sync")
def sync(tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)):
    if not (settings.KW_IOT_API_KEY and settings.KW_IOT_USER_ID):
        raise HTTPException(400, "케이웨더 IoT 연동이 설정되지 않았습니다. (KW_IOT_API_KEY / KW_IOT_USER_ID)")
    try:
        return kw_iot.sync(db, tenant)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"케이웨더 IoT 호출 실패: {e}")
