"""외부 날씨(기상청) 연동 어댑터 (PRD 3.3).

`WeatherProvider` 인터페이스 뒤에 Mock / KMA 구현을 두어 교체 가능하게 함.
- mock: API 키 없이 동작하는 결정론적 시뮬레이션 (지역/날짜 기반 일주기 곡선)
- kma: 공공데이터포털 ASOS 시간자료 (KMA_API_KEY 필요)

`WEATHER_PROVIDER` 설정으로 선택. 비교 엔진은 시간단위 외부기온을 분단위 내부
시계열에 맞춰 보간하여 대조합니다.
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from datetime import datetime, time, timedelta

import httpx
import pandas as pd
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Device, Tenant
from ..schemas import WeatherCompareOut, WeatherComparePoint
from . import analytics


class WeatherProvider(ABC):
    name: str = "base"

    @abstractmethod
    def hourly_temps(
        self, lat: float | None, lon: float | None, region_code: str | None,
        start: datetime, end: datetime,
    ) -> dict[datetime, float]:
        """시간단위 외부 기온 {정시 datetime: ℃}."""
        ...


class MockWeatherProvider(WeatherProvider):
    """결정론적 외부기온 시뮬레이터.

    위경도/날짜로 시드된 일주기(저온 05~06시, 고온 14~15시) 곡선.
    실제 환경에서는 산업현장 내부가 외부보다 높게 측정되도록 외부값을 보수적으로 생성.
    """

    name = "mock"

    def hourly_temps(self, lat, lon, region_code, start, end):
        seed = ((lat or 35.1) * 1000 + (lon or 129.0) * 10) % 7.0
        out: dict[datetime, float] = {}
        cur = start.replace(minute=0, second=0, microsecond=0)
        while cur <= end:
            doy = cur.timetuple().tm_yday
            # 계절 베이스(여름철 높음) + 일주기 + 위치 시드
            seasonal = 18.0 + 9.0 * math.sin((doy - 110) / 365.0 * 2 * math.pi)
            diurnal = 6.5 * math.sin((cur.hour - 9) / 24.0 * 2 * math.pi)
            base = seasonal + diurnal + seed - 2.0
            out[cur] = round(base, 1)
            cur += timedelta(hours=1)
        return out


class KmaWeatherProvider(WeatherProvider):
    """공공데이터포털 ASOS 시간자료 (best-effort).

    region_code 를 ASOS 지점번호(stnIds)로 사용. 키/지점 미설정 시 예외.
    """

    name = "kma"
    BASE = "https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList"

    def hourly_temps(self, lat, lon, region_code, start, end):
        if not settings.KMA_API_KEY:
            raise RuntimeError("KMA_API_KEY 미설정")
        stn = region_code or "159"  # 기본: 부산(159)
        params = {
            "serviceKey": settings.KMA_API_KEY,
            "dataType": "JSON",
            "dataCd": "ASOS",
            "dateCd": "HR",
            "stnIds": stn,
            "startDt": start.strftime("%Y%m%d"),
            "startHh": start.strftime("%H"),
            "endDt": end.strftime("%Y%m%d"),
            "endHh": end.strftime("%H"),
            "numOfRows": "999",
            "pageNo": "1",
        }
        out: dict[datetime, float] = {}
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(self.BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
            items = (
                data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            )
            for it in items:
                ts = it.get("tm")  # "YYYY-MM-DD HH:MM"
                ta = it.get("ta")  # 기온
                if ts and ta not in (None, ""):
                    dt = datetime.strptime(ts, "%Y-%m-%d %H:%M").replace(minute=0)
                    out[dt] = float(ta)
        return out


def get_provider() -> WeatherProvider:
    if settings.WEATHER_PROVIDER.lower() == "kma":
        return KmaWeatherProvider()
    return MockWeatherProvider()


def compare(
    db: Session, tenant: Tenant, device_sn: str,
    start: datetime | None, end: datetime | None, interval: int,
) -> WeatherCompareOut:
    provider = get_provider()
    dev = db.get(Device, device_sn)
    if dev is None or dev.tenant_id != tenant.id:
        raise ValueError("해당 기기에 접근 권한이 없습니다.")

    indoor = analytics.time_series(db, tenant, device_sn, start, end, interval)
    if not indoor.points:
        return WeatherCompareOut(
            device_sn=device_sn, provider=provider.name, interval_minutes=interval,
            points=[], max_delta=None, enclosed_alert=False,
            enclosed_threshold=settings.ENCLOSED_DELTA_ALERT,
        )

    t0 = indoor.points[0].t
    t1 = indoor.points[-1].t
    try:
        hourly = provider.hourly_temps(dev.latitude, dev.longitude, dev.region_code, t0, t1)
    except Exception:  # noqa: BLE001  (외부 API 실패 시 빈 비교)
        hourly = {}

    # 시간단위 외부기온 -> 분단위 보간 시리즈
    if hourly:
        hs = pd.Series(hourly).sort_index()
        full_idx = pd.date_range(t0.replace(minute=0), t1 + timedelta(hours=1), freq=f"{interval}min")
        outdoor = hs.reindex(hs.index.union(full_idx)).interpolate(method="time").reindex(full_idx)
    else:
        outdoor = pd.Series(dtype=float)

    points: list[WeatherComparePoint] = []
    max_delta = None
    for p in indoor.points:
        ot = None
        if not outdoor.empty:
            nearest = outdoor.index.get_indexer([pd.Timestamp(p.t)], method="nearest")
            if nearest[0] != -1:
                v = outdoor.iloc[nearest[0]]
                ot = None if pd.isna(v) else round(float(v), 1)
        delta = None
        if p.feels_like is not None and ot is not None:
            delta = round(p.feels_like - ot, 1)
            if max_delta is None or delta > max_delta:
                max_delta = delta
        points.append(
            WeatherComparePoint(
                t=p.t, indoor_feels_like=p.feels_like, outdoor_temperature=ot, delta=delta
            )
        )

    enclosed = max_delta is not None and max_delta >= settings.ENCLOSED_DELTA_ALERT
    return WeatherCompareOut(
        device_sn=device_sn, provider=provider.name, interval_minutes=interval,
        points=points, max_delta=max_delta, enclosed_alert=enclosed,
        enclosed_threshold=settings.ENCLOSED_DELTA_ALERT,
    )
