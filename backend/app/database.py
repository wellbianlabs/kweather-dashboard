"""SQLAlchemy 엔진/세션 구성.

DATABASE_URL 에 따라 SQLite 또는 PostgreSQL 로 동작합니다. 코드 변경은 필요 없습니다.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_is_postgres = settings.DATABASE_URL.startswith("postgres")

if _is_sqlite:
    _engine_kwargs = dict(
        # SQLite 는 동일 스레드만 허용하므로 FastAPI 멀티스레드용으로 해제
        connect_args={"check_same_thread": False},
        pool_pre_ping=False,
    )
elif _is_postgres:
    # 서버리스(Vercel) + Supabase 풀러: 연결 재사용 금지(NullPool), 전용 스키마로 격리.
    # search_path 를 연결 단위로 주입해 기존 프로젝트의 public 스키마와 분리한다.
    _engine_kwargs = dict(
        poolclass=NullPool,
        connect_args={"options": "-csearch_path=kweather,public"},
    )
else:
    _engine_kwargs = dict(pool_pre_ping=True)

engine = create_engine(settings.DATABASE_URL, future=True, **_engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI 의존성: 요청 단위 DB 세션."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (모델 등록)

    Base.metadata.create_all(bind=engine)
