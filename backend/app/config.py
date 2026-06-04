"""애플리케이션 설정.

`DATABASE_URL` 환경변수 하나로 SQLite(기본) <-> PostgreSQL 전환이 가능합니다.
PostgreSQL 사용 시:  postgresql+psycopg2://postgres:비번@localhost:5432/kweather
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 기본값은 설정 없이 즉시 실행되는 SQLite. (PostgreSQL 전환은 .env에서 DATABASE_URL만 교체)
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'kweather.db').as_posix()}"

    # 기상청/날씨 어댑터: "mock" | "kma"
    WEATHER_PROVIDER: str = "mock"
    KMA_API_KEY: str = ""  # 공공데이터포털 서비스키 (WEATHER_PROVIDER=kma 일 때 사용)

    # 폭염 위험 단계 임계값 (체감온도 A-TEMP, 단위 ℃)  — 고용노동부/기상청 기준
    HEAT_ATTENTION: float = 31.0  # 관심
    HEAT_CAUTION: float = 33.0    # 주의
    HEAT_WARNING: float = 35.0    # 경고
    HEAT_DANGER: float = 38.0     # 위험

    # 외부(기상청) 대비 내부 체감온도가 이만큼(℃) 이상 높으면 '밀폐형 폭염' 경고
    ENCLOSED_DELTA_ALERT: float = 5.0

    # 리포트/내보내기 임시 디렉터리
    EXPORT_DIR: Path = BASE_DIR / "exports"


@lru_cache
def get_settings() -> "Settings":
    s = Settings()
    s.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    return s


settings = get_settings()
