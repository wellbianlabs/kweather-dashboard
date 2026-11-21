"""회원가입 / 로그인 (테넌트 단위 계정)."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import block_demo, get_tenant, is_admin, is_demo
from ..models import Device, SensorLog, Tenant
from ..schemas import AuthOut, LoginIn, ProfileUpdateIn, SignupIn
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
    return AuthOut(
        token=tenant.api_key, email=tenant.email, company_name=tenant.name,
        has_data=False, is_admin=is_admin(tenant), is_demo=is_demo(tenant),
    )


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    tenant = db.scalar(select(Tenant).where(func.lower(Tenant.email) == email))
    if tenant is None or not verify_password(payload.password, tenant.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    return AuthOut(
        token=tenant.api_key, email=tenant.email, company_name=tenant.name,
        has_data=_has_data(db, tenant), is_admin=is_admin(tenant), is_demo=is_demo(tenant),
    )


@router.get("/me", response_model=AuthOut)
def me(tenant: Tenant = Depends(get_tenant), db: Session = Depends(get_db)):
    return AuthOut(
        token=tenant.api_key, email=tenant.email, company_name=tenant.name,
        has_data=_has_data(db, tenant), is_admin=is_admin(tenant), is_demo=is_demo(tenant),
    )


@router.patch("/me", response_model=AuthOut)
def update_me(
    payload: ProfileUpdateIn,
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    """현재 테넌트의 회원정보 수정 — 이메일/사업장명/비밀번호(선택)."""
    block_demo(tenant)
    # 이메일 변경(값이 들어왔고 기존과 다를 때만 검증/적용)
    if payload.email is not None:
        email = payload.email.strip().lower()
        if not email:
            raise HTTPException(400, "이메일을 입력해 주세요.")
        if email != (tenant.email or ""):
            if not _EMAIL_RE.match(email):
                raise HTTPException(400, "올바른 이메일 형식이 아닙니다.")
            dup = db.scalar(
                select(Tenant).where(
                    func.lower(Tenant.email) == email, Tenant.id != tenant.id
                )
            )
            if dup is not None:
                raise HTTPException(400, "이미 사용 중인 이메일입니다.")
            tenant.email = email

    # 사업장명 변경 → tenant.name
    if payload.company_name is not None:
        name = payload.company_name.strip()
        if not name:
            raise HTTPException(400, "사업장명을 입력해 주세요.")
        tenant.name = name

    # 비밀번호 변경 — current_password 검증 필수, 신규 최소 6자
    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(400, "현재 비밀번호를 입력해 주세요.")
        if not verify_password(payload.current_password, tenant.password_hash):
            raise HTTPException(400, "현재 비밀번호가 올바르지 않습니다.")
        if len(payload.new_password) < 6:
            raise HTTPException(400, "새 비밀번호는 6자 이상이어야 합니다.")
        tenant.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(tenant)
    return AuthOut(
        token=tenant.api_key, email=tenant.email, company_name=tenant.name,
        has_data=_has_data(db, tenant), is_admin=is_admin(tenant), is_demo=is_demo(tenant),
    )
