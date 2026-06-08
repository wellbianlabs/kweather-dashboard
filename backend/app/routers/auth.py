"""회원가입 / 로그인 (테넌트 단위 계정)."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_tenant
from ..models import Device, SensorLog, Tenant
from ..schemas import AuthOut, LoginIn, SignupIn
from ..security import hash_password, new_api_key, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _has_data(db: Session, tenant: Tenant) -> bool:
    return db.scalar(
        select(func.count())
        .select_from(SensorLog)
        .join(Device, Device.device_sn == SensorLog.device_sn)
        .where(Device.tenant_id == tenant.id)
    ) > 0


@router.post("/signup", response_model=AuthOut, status_code=201)
def signup(payload: SignupIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(400, "올바른 이메일 형식이 아닙니다.")
    exists = db.scalar(select(Tenant).where(func.lower(Tenant.email) == email))
    if exists is not None:
        raise HTTPException(409, "이미 가입된 이메일입니다.")
    tenant = Tenant(
        name=payload.company_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        api_key=new_api_key(),
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return AuthOut(token=tenant.api_key, email=tenant.email, company_name=tenant.name, has_data=False)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    tenant = db.scalar(select(Tenant).where(func.lower(Tenant.email) == email))
    if tenant is None or not verify_password(payload.password, tenant.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    return AuthOut(
        token=tenant.api_key, email=tenant.email, company_name=tenant.name,
        has_data=_has_data(db, tenant),
    )


@router.get("/me", response_model=AuthOut)
def me(tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)):
    return AuthOut(
        token=tenant.api_key, email=tenant.email, company_name=tenant.name,
        has_data=_has_data(db, tenant),
    )
