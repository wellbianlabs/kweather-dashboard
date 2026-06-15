"""API 접근 로깅 미들웨어 — 관리자 대시보드의 방문/트래픽/업로드 현황 집계 기반.

`/api/*` 요청마다 AccessLog 1행을 best-effort 로 기록한다(실패는 요청에 영향 없음).
라우트는 `request.state` 에 컨텍스트를 남길 수 있다:
- tenant_id: 인증된 테넌트(get_tenant 가 설정)
- upload_rows: 업로드 반영 행수(업로드 라우트가 설정)
"""
from __future__ import annotations

from starlette.concurrency import run_in_threadpool

from .database import SessionLocal
from .models import AccessLog
from .utils import kst_now

# 로깅 제외 경로(자기참조/헬스체크/프리플라이트)
_SKIP_PREFIXES = ("/api/admin",)
_SKIP_EXACT = ("/api/health",)


def _client_ip(request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:80]
    return (request.client.host if request.client else "?")[:80]


def _kind_for(path: str) -> str:
    if path.startswith("/api/upload"):
        return "upload"
    if path.startswith("/api/reports"):
        return "report"
    if path.startswith("/api/auth"):
        return "visit"
    return "api"


def _record(request, status_code: int) -> None:
    path = request.url.path
    tenant_id = getattr(request.state, "tenant_id", None)
    visitor = f"t:{tenant_id}" if tenant_id else f"ip:{_client_ip(request)}"
    now = kst_now()
    row = AccessLog(
        ts=now,
        ymd=now.strftime("%Y%m%d"),
        method=request.method[:8],
        path=path[:200],
        status=int(status_code),
        kind=_kind_for(path),
        tenant_id=tenant_id,
        visitor=visitor[:80],
        rows=getattr(request.state, "upload_rows", None),
    )
    db = SessionLocal()
    try:
        db.add(row)
        db.commit()
    except Exception:  # noqa: BLE001  (로깅 실패는 무시)
        db.rollback()
    finally:
        db.close()


async def access_log_middleware(request, call_next):
    response = await call_next(request)
    try:
        path = request.url.path
        if (
            request.method != "OPTIONS"
            and path.startswith("/api/")
            and path not in _SKIP_EXACT
            and not any(path.startswith(p) for p in _SKIP_PREFIXES)
        ):
            await run_in_threadpool(_record, request, response.status_code)
    except Exception:  # noqa: BLE001
        pass
    return response
