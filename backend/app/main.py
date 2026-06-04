"""FastAPI 진입점.

- 시작 시 테이블 생성 + 기본 테넌트(데모) 시드
- /api/* REST 엔드포인트
- 빌드된 프론트엔드(frontend/dist)가 있으면 정적 서빙 (단일 서버 배포)
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from .config import settings
from .database import SessionLocal, init_db
from .models import Tenant
from .routers import dashboard, devices, reports, upload, weather

DEMO_API_KEY = "demo-key"

app = FastAPI(
    title="케이웨더 체감온도계 대시보드 API",
    version="1.0.0",
    description="폭염/체감온도 안전보건 대시보드 및 리포트 자동화",
)

# 개발 편의를 위해 모든 오리진 허용 (운영 시 도메인 제한 권장)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(devices.router)
app.include_router(dashboard.router)
app.include_router(weather.router)
app.include_router(reports.router)


@app.on_event("startup")
def _startup() -> None:
    # 서버리스 콜드스타트에서 DB 일시 장애가 함수 기동 자체를 막지 않도록 예외 격리.
    try:
        init_db()
        with SessionLocal() as db:
            if db.scalar(select(Tenant).where(Tenant.api_key == DEMO_API_KEY)) is None:
                db.add(Tenant(name="데모 사업장", api_key=DEMO_API_KEY))
                db.commit()
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger("uvicorn.error").warning("startup init skipped: %s", exc)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "database": "postgresql" if settings.DATABASE_URL.startswith("postgres") else "sqlite",
        "weather_provider": settings.WEATHER_PROVIDER,
        "thresholds": {
            "attention": settings.HEAT_ATTENTION,
            "caution": settings.HEAT_CAUTION,
            "warning": settings.HEAT_WARNING,
            "danger": settings.HEAT_DANGER,
        },
    }


# --- 빌드된 프론트엔드 정적 서빙 (선택) ---
_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="frontend")
