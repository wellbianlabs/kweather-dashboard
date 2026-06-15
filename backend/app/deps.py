"""요청 의존성 — 테넌트 인증/격리 가드 (PRD 6.3).

클라이언트는 `X-API-Key` 헤더로 자신의 테넌트를 식별합니다.
모든 데이터 조회/수정은 이 테넌트로 스코프됩니다.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Tenant


def get_tenant(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Tenant:
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-API-Key 헤더가 필요합니다.",
        )
    tenant = db.scalar(select(Tenant).where(Tenant.api_key == x_api_key))
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="유효하지 않은 API 키입니다.",
        )
    # 접근 로그 미들웨어가 읽을 수 있도록 요청 컨텍스트에 식별정보 저장(추가 쿼리 없이).
    request.state.tenant_id = tenant.id
    return tenant


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()}


def is_admin(tenant: Tenant) -> bool:
    return bool(tenant.email) and tenant.email.strip().lower() in admin_emails()


def get_admin(tenant: Tenant = Depends(get_tenant)) -> Tenant:
    """관리자 전용 가드 — 관리자 이메일 계정만 통과."""
    if not is_admin(tenant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다.",
        )
    return tenant
