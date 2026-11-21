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
from starlette.exceptions import HTTPException as StarletteHTTPException

from .access import access_log_middleware
from .config import settings
from .database import SessionLocal, init_db
from .models import Tenant
from .services import appsettings
from .routers import admin, auth, dashboard, data, devices, geocode, reports, upload, weather

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

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(data.router)
app.include_router(devices.router)
app.include_router(dashboard.router)
app.include_router(geocode.router)
app.include_router(weather.router)
app.include_router(reports.router)
app.include_router(admin.router)

# API 접근 로깅(방문/트래픽/업로드 현황) — 관리자 대시보드 집계 기반
app.middleware("http")(access_log_middleware)


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
        "weather_provider": appsettings.get("WEATHER_PROVIDER"),
        "kweather_key_set": bool(appsettings.get("KW_API_KEY")),
        "kma_asos_key_set": bool(appsettings.get("KMA_API_KEY")),
        "geocoder": "kakao" if appsettings.get("KAKAO_REST_KEY") else "nominatim",
        "thresholds": {
            "attention": settings.HEAT_ATTENTION,
            "caution": settings.HEAT_CAUTION,
            "warning": settings.HEAT_WARNING,
            "danger": settings.HEAT_DANGER,
        },
    }


# --- 빌드된 프론트엔드 정적 서빙 (선택) ---
class SPAStaticFiles(StaticFiles):
    """SPA(react-router BrowserRouter) 폴백 정적 서빙.

    실제 정적 파일(/assets/..., favicon, *.geo.json 등)은 그대로 서빙하고,
    파일이 없는 클라이언트 라우트(/map, /report 등)는 index.html로 폴백해
    딥링크/새로고침이 404가 아닌 React 앱을 로드하도록 한다.

    단, `/api/...` 경로는 절대 폴백하지 않는다. (등록된 API 라우터가 이 mount보다
    먼저 매칭되지만, 존재하지 않는 /api/... 가 여기까지 내려오면 index.html 대신
    기존대로 404를 유지하기 위한 가드.)
    """

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api/") and path != "api":
                return await super().get_response("index.html", scope)
            raise


_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", SPAStaticFiles(directory=str(_DIST), html=True), name="frontend")
