"""요청 의존성 — 테넌트 인증/격리 가드 (PRD 6.3).

클라이언트는 `X-API-Key` 헤더로 자신의 테넌트를 식별합니다.
모든 데이터 조회/수정은 이 테넌트로 스코프됩니다.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Tenant


def get_tenant(
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
    return tenant
