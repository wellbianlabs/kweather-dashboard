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
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import heat
from ..config import settings
from ..models import Device, SensorLog, Tenant
from ..schemas import CurrentWeatherOut, HeatLevelOut, WeatherCompareOut, WeatherComparePoint
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


# 시도 코드(행정동 앞 2자리) -> 대표 ASOS 관측소 번호 (기상청 일자료 폴백용)
_SIDO_ASOS = {
    "11": "108", "26": "159", "27": "143", "28": "112", "29": "156", "30": "133",
    "31": "152", "36": "239", "41": "119", "42": "105", "43": "131", "44": "129",
    "45": "146", "46": "165", "47": "136", "48": "155", "50": "184", "51": "105",
}


def _kma_asos_daily(code: str, ds: str) -> dict | None:
    """기상청 API허브(apihub.kma.go.kr) ASOS 일자료 — 케이웨더 아카이브 미수록 날짜 대비 폴백.

    KMA_API_KEY(=API허브 authKey) 필요. 응답은 고정폭 텍스트(헤더 주석 + 데이터 라인).
    헤더의 컬럼명(TA_AVG/TA_MAX/TA_MIN/HM_AVG)을 찾아 인덱스로 파싱한다.
    """
    if not settings.KMA_API_KEY or not code:
        return None
    stn = _SIDO_ASOS.get(str(code)[:2])
    if not stn:
        return None
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.get(
                "https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd3.php",
                params={"tm1": ds, "tm2": ds, "stn": stn, "disp": "0", "help": "1", "authKey": settings.KMA_API_KEY},
            )
            text = r.text
            if r.status_code != 200 or "활용신청" in text or "용량" in text:
                return None

            import re as _re

            lines = text.splitlines()
            # 상단 범례("#  11. TA_AVG : ...")에서 컬럼명 -> 데이터 인덱스(번호-1) 맵 구성
            idx_map: dict[str, int] = {}
            for ln in lines:
                m = _re.match(r"#\s*(\d+)\.\s+([A-Z0-9_]+)\s*:", ln)
                if m:
                    idx_map[m.group(2)] = int(m.group(1)) - 1
            # 데이터 라인: 날짜로 시작하는 비주석 라인
            data = None
            for ln in lines:
                st = ln.strip()
                if st and not st.startswith("#") and st.split()[0].startswith(ds[:8]):
                    data = st.split()
                    break
            if not data:
                return None

            def _pick(name):
                i = idx_map.get(name)
                if i is not None and i < len(data):
                    try:
                        v = float(data[i])
                        # KMA 결측 표기(-9, -99 계열) 제외
                        return None if v in (-9.0, -99.0, -999.0) else v
                    except ValueError:
                        return None
                return None

            avg = _pick("TA_AVG"); mx = _pick("TA_MAX"); mn = _pick("TA_MIN")
            hu = _pick("HM_AVG") or _pick("RHM_AVG")
            if avg is not None or mx is not None:
                return {"avg": avg, "max": mx, "min": mn, "humi": hu, "source": "케이웨더 기상관측자료", "region": None}
    except Exception:  # noqa: BLE001
        return None
    return None


class KWeatherProvider(WeatherProvider):
    """케이웨더(Air365) Open API. 환경변수 KW_API_KEY + KW_BASE_URL 로 설정(Vercel 입력).

    위치는 행정동 코드(10자리). device.region_code 에 코드가 있으면 사용,
    없으면 위경도를 kw-gis-gps 로 변환. 현재 실황은 kw-odam1(t1h/senseTemp/reh).
    """

    name = "kweather"

    def _get(self, client, sensor: str, code: str | None = None):
        url = f"{settings.KW_BASE_URL}/{sensor}" + (f"/{code}" if code else "")
        r = client.get(url, params={"api_key": settings.KW_API_KEY})
        r.raise_for_status()
        j = r.json()
        if str(j.get("error")) != "0":
            raise RuntimeError(j.get("message") or "KWeather error")
        return j.get("data") or {}

    def _dong_code(self, client, lat, lon, region_code) -> str | None:
        # 기기에 행정동 코드가 있으면 사용
        if region_code and str(region_code).isdigit() and len(str(region_code)) >= 8:
            return str(region_code)
        # 없으면 위경도 -> 행정동 코드(카카오 coord2regioncode, kw-odam1 호환)
        if lat is None or lon is None:
            return None
        from . import geocode as geocode_svc

        return geocode_svc.region_code(lat, lon)

    def current(self, lat, lon, region_code) -> dict | None:
        """현재 외부 실황: {temp, feels, humidity, ts, region}."""
        if not settings.KW_API_KEY:
            raise RuntimeError("KW_API_KEY 미설정")
        with httpx.Client(timeout=12.0) as client:
            code = self._dong_code(client, lat, lon, region_code)
            if not code:
                return None
            data = self._get(client, "kw-odam1", code)
            entry = data.get(code) or next(iter(data.values()), None)
            if not entry:
                return None
            d = entry.get("data", {})
            return {
                "temp": d.get("t1h"),
                "feels": d.get("senseTemp"),
                "humidity": d.get("reh"),
                "ts": entry.get("service", {}).get("timestamp"),
                "region": " ".join(x for x in [d.get("state"), d.get("city"), d.get("city2")] if x),
            }

    def past_daily(self, lat, lon, region_code, day) -> dict | None:
        """특정 과거 일자의 외부 일별 요약(평균/최고/최저 기온, 평균 습도).

        1년자료(w4/v2/cbko)를 우선 조회하고, 비어 있으면 전일날씨(kw-cbko1, w3)로 폴백한다.
        day: datetime.date
        """
        if not settings.KW_API_KEY:
            return None
        ds = day.strftime("%Y%m%d")
        with httpx.Client(timeout=12.0) as client:
            code = self._dong_code(client, lat, lon, region_code)
            if not code:
                return None
            # 1) 과거 1년자료 (별도 상품 권한 필요)
            try:
                r = client.get(
                    f"{settings.KW_PAST_BASE_URL}/cbko/{code}",
                    params={"startdate": ds, "enddate": ds, "api_key": settings.KW_API_KEY},
                )
                if r.status_code == 200 and str(r.json().get("error")) == "0":
                    d = r.json().get("data") or {}
                    avg = (d.get("temp") or {}).get(ds)
                    mx = (d.get("maxTemp") or {}).get(ds)
                    mn = (d.get("minTemp") or {}).get(ds)
                    hu = (d.get("humi") or {}).get(ds)
                    if avg is not None or mx is not None:
                        return {"avg": avg, "max": mx, "min": mn, "humi": hu,
                                "source": "케이웨더 과거기상자료",
                                "region": " ".join(x for x in [d.get("state"), d.get("city"), d.get("city2")] if x)}
            except Exception:  # noqa: BLE001
                pass
            # 2) 전일날씨(어제) 폴백 — 요청일이 cbko1 의 데이터 일자와 같을 때만
            try:
                data = self._get(client, "kw-cbko1", code)
                entry = data.get(code) or next(iter(data.values()), None)
                if entry:
                    ts = str(entry.get("service", {}).get("timestamp") or "")
                    dd = entry.get("data", {})
                    if ts[:8] == ds and (dd.get("temp") is not None or dd.get("maxTemp") is not None):
                        return {"avg": dd.get("temp"), "max": dd.get("maxTemp"), "min": dd.get("minTemp"),
                                "humi": dd.get("humi"), "source": "케이웨더 전일기상자료",
                                "region": " ".join(x for x in [dd.get("state"), dd.get("city"), dd.get("city2")] if x)}
            except Exception:  # noqa: BLE001
                pass
        # 3) 케이웨더 아카이브에 없으면 기상청 ASOS 일자료 직접 조회(최근 날짜 대비)
        return _kma_asos_daily(code, ds)

    def hourly_temps(self, lat, lon, region_code, start, end):
        # 케이웨더 실황은 현재값 1점 — 타임스탬프가 조회 구간에 들면 해당 시각에 매핑.
        cur = self.current(lat, lon, region_code)
        if not cur or cur.get("temp") is None:
            return {}
        ts = str(cur.get("ts") or "")
        try:
            dt = datetime.strptime(ts[:12], "%Y%m%d%H%M").replace(minute=0, second=0, microsecond=0)
        except Exception:  # noqa: BLE001
            return {}
        return {dt: float(cur["temp"])} if start <= dt <= end else {}


def get_provider() -> WeatherProvider:
    p = settings.WEATHER_PROVIDER.lower()
    if p == "kma":
        return KmaWeatherProvider()
    if p in ("kweather", "wellbian"):
        return KWeatherProvider()
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


def current_external(db: Session, tenant: Tenant, device_sn: str) -> CurrentWeatherOut:
    """현재 외부 날씨(케이웨더 실측) + 현장 최신 측정값 비교."""
    dev = db.get(Device, device_sn)
    if dev is None or dev.tenant_id != tenant.id:
        raise ValueError("해당 기기에 접근 권한이 없습니다.")
    provider = get_provider()

    cur = None
    if hasattr(provider, "current"):
        try:
            cur = provider.current(dev.latitude, dev.longitude, dev.region_code)
        except Exception:  # noqa: BLE001
            cur = None

    latest = db.scalars(
        select(SensorLog).where(SensorLog.device_sn == device_sn).order_by(SensorLog.measured_at.desc())
    ).first()
    indoor_feels = float(latest.feels_like_temperature) if latest else None
    indoor_temp = float(latest.temperature) if latest else None
    indoor_at = latest.measured_at.strftime("%Y-%m-%d %H:%M") if latest else None

    out_temp = cur.get("temp") if cur else None
    out_feels = cur.get("feels") if cur else None
    out_humi = cur.get("humidity") if cur else None
    ts = str(cur.get("ts")) if cur and cur.get("ts") else None
    observed = None
    if ts and len(ts) >= 12:
        observed = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}"

    available = cur is not None and out_temp is not None
    delta = round(indoor_feels - float(out_temp), 1) if (available and indoor_feels is not None) else None
    enclosed = delta is not None and delta >= settings.ENCLOSED_DELTA_ALERT

    # 야외 실시간 폭염 위험단계 (외부 체감온도 기준)
    outdoor_level = None
    if out_feels is not None:
        lv = heat.classify(float(out_feels))
        outdoor_level = HeatLevelOut(code=lv.code, label=lv.label, color=lv.color, rank=lv.rank)

    message = None
    if not available:
        if provider.name != "kweather":
            message = "현재 외부 날씨는 케이웨더 연동(WEATHER_PROVIDER=kweather) 시 제공됩니다."
        elif not (dev.latitude or dev.region_code):
            message = "기기에 주소(위경도) 또는 지역코드가 없어 외부 날씨를 조회할 수 없습니다."
        else:
            message = "외부 날씨를 불러오지 못했습니다."

    return CurrentWeatherOut(
        provider=provider.name, available=available, source="기상청",
        region=(cur.get("region") if cur else None),
        outdoor_temp=round(float(out_temp), 1) if out_temp is not None else None,
        outdoor_feels=round(float(out_feels), 1) if out_feels is not None else None,
        outdoor_humidity=round(float(out_humi), 1) if out_humi is not None else None,
        outdoor_level=outdoor_level,
        observed_at=observed,
        indoor_feels=indoor_feels, indoor_temp=indoor_temp, indoor_at=indoor_at,
        delta=delta, enclosed_alert=enclosed, enclosed_threshold=settings.ENCLOSED_DELTA_ALERT,
        message=message,
    )
