"""런타임 앱 설정 — DB(AppSetting) 우선, 없으면 .env(config.settings) 폴백.

- 외부 연동 키(WEATHER_PROVIDER/KW_API_KEY/KMA_API_KEY/KAKAO_REST_KEY 등)를
  관리자 페이지에서 저장하면 재시작 없이 반영된다.
- uvicorn 멀티워커 환경을 고려해 짧은 TTL 캐시를 두고 각 워커가 주기적으로 DB를 재로딩한다.
"""
from __future__ import annotations

import time

from sqlalchemy import select

from ..config import settings as _env
from ..database import SessionLocal
from ..models import AppSetting

# 관리자 페이지에서 다루는 키(이 목록만 노출/저장). 값은 문자열.
MANAGED_KEYS = [
    "WEATHER_PROVIDER",
    "KW_API_KEY",
    "KW_BASE_URL",
    "KW_PAST_BASE_URL",
    "KMA_API_KEY",
    "KAKAO_REST_KEY",
]
# 마스킹해서 노출할 비밀 키(값 자체는 반환하지 않음)
SECRET_KEYS = {"KW_API_KEY", "KMA_API_KEY", "KAKAO_REST_KEY"}

_TTL = 15.0
_cache: dict[str, str] = {}
_cache_ts = 0.0


def _refresh() -> None:
    global _cache, _cache_ts
    try:
        with SessionLocal() as db:
            rows = db.scalars(select(AppSetting)).all()
            _cache = {r.name: (r.value or "") for r in rows}
    except Exception:  # noqa: BLE001  (DB 일시장애 시 캐시 유지)
        pass
    _cache_ts = time.monotonic()


def get(name: str) -> str:
    """런타임 설정값 — DB값이 있으면 그 값, 없으면 .env 기본값."""
    if time.monotonic() - _cache_ts > _TTL:
        _refresh()
    v = _cache.get(name)
    if v:  # 비어있지 않은 DB값만 우선
        return v
    return str(getattr(_env, name, "") or "")


def invalidate() -> None:
    """저장 직후 캐시 무효화(즉시 재로딩 유도)."""
    global _cache_ts
    _cache_ts = 0.0


def save(db, updates: dict[str, str]) -> None:
    """관리자 입력 저장. 빈 값은 해당 행 삭제(=.env 폴백). MANAGED_KEYS 외는 무시."""
    for name, value in updates.items():
        if name not in MANAGED_KEYS:
            continue
        row = db.get(AppSetting, name)
        v = (value or "").strip()
        if v == "":
            if row is not None:
                db.delete(row)
        elif row is None:
            db.add(AppSetting(name=name, value=v))
        else:
            row.value = v
    db.commit()
    invalidate()


def masked_status(db) -> dict[str, dict]:
    """관리자 화면 표시용 현재 설정 상태(비밀키는 마스킹)."""
    rows = {r.name: (r.value or "") for r in db.scalars(select(AppSetting)).all()}
    out: dict[str, dict] = {}
    for name in MANAGED_KEYS:
        db_val = rows.get(name, "")
        env_val = str(getattr(_env, name, "") or "")
        effective = db_val or env_val
        source = "db" if db_val else ("env" if env_val else "none")
        if name in SECRET_KEYS:
            masked = ("••••" + effective[-4:]) if len(effective) >= 4 else ("설정됨" if effective else "")
            out[name] = {"set": bool(effective), "masked": masked, "source": source}
        else:
            out[name] = {"set": bool(effective), "value": effective, "source": source}
    return out
