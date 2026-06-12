"""기기/사업장 메타데이터 관리 (PRD 2.3 / 4.1)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Device, Tenant
from ..schemas import DeviceCreate, DeviceOut, DeviceUpdate

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
def list_devices(tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(Device).where(Device.tenant_id == tenant.id).order_by(Device.device_sn)
        )
    )


def _ensure_region_code(dev: Device) -> None:
    """주소 확정(등록/수정) 시 행정동 코드를 1회 해석해 저장.

    이후 날씨 조회는 저장값을 사용하므로 매 요청 좌표→행정동 변환이 필요 없다.
    (해석 실패 시에도 등록은 진행 — 날씨 조회 측에 최근접 관측소 폴백 있음)
    """
    if dev.region_code or dev.latitude is None or dev.longitude is None:
        return
    from ..services import geocode as geocode_svc

    try:
        code = geocode_svc.region_code(dev.latitude, dev.longitude)
        if code:
            dev.region_code = code
    except Exception:  # noqa: BLE001
        pass


@router.post("", response_model=DeviceOut, status_code=201)
def create_device(
    payload: DeviceCreate, tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)
):
    existing = db.get(Device, payload.device_sn)
    if existing is not None:
        raise HTTPException(409, "이미 존재하는 기기 SN 입니다.")
    dev = Device(tenant_id=tenant.id, **payload.model_dump())
    _ensure_region_code(dev)
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev


def _owned(db: Session, tenant: Tenant, device_sn: str) -> Device:
    dev = db.get(Device, device_sn)
    if dev is None or dev.tenant_id != tenant.id:
        raise HTTPException(404, "기기를 찾을 수 없습니다.")
    return dev


@router.put("/{device_sn}", response_model=DeviceOut)
def update_device(
    device_sn: str, payload: DeviceUpdate,
    tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db),
):
    dev = _owned(db, tenant, device_sn)
    data = payload.model_dump(exclude_unset=True)
    # 좌표가 바뀌는데 행정동 코드가 함께 오지 않으면 기존 코드를 비우고 재확정
    if ("latitude" in data or "longitude" in data) and not data.get("region_code"):
        old = (dev.latitude, dev.longitude)
        new = (data.get("latitude", dev.latitude), data.get("longitude", dev.longitude))
        if new != old:
            dev.region_code = None
    for k, v in data.items():
        setattr(dev, k, v)
    _ensure_region_code(dev)
    db.commit()
    db.refresh(dev)
    return dev


@router.delete("/{device_sn}", status_code=204)
def delete_device(
    device_sn: str, tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)
):
    dev = _owned(db, tenant, device_sn)
    db.delete(dev)
    db.commit()
