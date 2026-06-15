"""공용 유틸."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

_KST = timezone(timedelta(hours=9))


def kst_now() -> datetime:
    """현재 시각(KST, naive). 측정값·로그 표기를 한국시간으로 일관 처리."""
    return datetime.now(_KST).replace(tzinfo=None)
