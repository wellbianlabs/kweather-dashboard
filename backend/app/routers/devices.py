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


@router.post("", response_model=DeviceOut, status_code=201)
def create_device(
    payload: DeviceCreate, tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)
):
    existing = db.get(Device, payload.device_sn)
    if existing is not None:
        raise HTTPException(409, "이미 존재하는 기기 SN 입니다.")
    dev = Device(tenant_id=tenant.id, **payload.model_dump())
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
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(dev, k, v)
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
