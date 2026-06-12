"""측정 데이터 초기화 — 이용자가 자신의 업로드 데이터를 삭제."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Device, ExternalDailyCache, SensorLog, Tenant

router = APIRouter(prefix="/api/data", tags=["data"])

DEMO_API_KEY = "demo-key"


@router.delete("")
def reset_data(
    device_sn: str | None = None,
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
) -> dict:
    """테넌트 소유 측정 데이터 삭제. device_sn 지정 시 해당 기기만, 미지정 시 전체.

    기기 등록 정보와 계정은 유지된다. 외부 기상 캐시도 함께 비운다.
    """
    if tenant.api_key == DEMO_API_KEY:
        raise HTTPException(403, "공용 데모 계정의 데이터는 초기화할 수 없습니다.")

    if device_sn:
        dev = db.get(Device, device_sn)
        if dev is None or dev.tenant_id != tenant.id:
            raise HTTPException(404, "기기를 찾을 수 없습니다.")
        sns = [device_sn]
    else:
        sns = list(
            db.scalars(select(Device.device_sn).where(Device.tenant_id == tenant.id))
        )
    if not sns:
        return {"deleted_logs": 0, "devices": []}

    deleted = db.scalar(
        select(func.count()).select_from(SensorLog).where(SensorLog.device_sn.in_(sns))
    ) or 0
    db.execute(delete(SensorLog).where(SensorLog.device_sn.in_(sns)))
    db.execute(delete(ExternalDailyCache).where(ExternalDailyCache.device_sn.in_(sns)))
    db.commit()
    return {"deleted_logs": int(deleted), "devices": sns}
