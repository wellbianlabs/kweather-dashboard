"""Pydantic 입출력 스키마."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------- Auth ----------
class SignupIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=4, max_length=128)
    company_name: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: str
    password: str


class AuthOut(BaseModel):
    token: str           # X-API-Key 로 사용
    email: str | None
    company_name: str
    has_data: bool = False  # 기존 업로드 데이터 유무 (온보딩 단계 결정용)


# ---------- Device ----------
class DeviceBase(BaseModel):
    company_name: str | None = None
    location_name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    region_code: str | None = None


class DeviceCreate(DeviceBase):
    device_sn: str


class DeviceUpdate(DeviceBase):
    pass


class DeviceOut(DeviceBase):
    model_config = ConfigDict(from_attributes=True)
    device_sn: str


# ---------- Upload ----------
class UploadResult(BaseModel):
    filename: str
    rows_parsed: int
    rows_inserted: int
    rows_updated: int
    rows_skipped: int
    new_devices: list[str]
    affected_devices: list[str] = Field(default_factory=list)  # 파일에 포함된 모든 기기 SN
    min_date: str | None = None  # 데이터 최소 일자 (YYYY-MM-DD) — 대시보드 자동 이동용
    max_date: str | None = None  # 데이터 최대 일자 (YYYY-MM-DD)
    encoding: str
    errors: list[str] = Field(default_factory=list)


# ---------- Dashboard ----------
class HeatLevelOut(BaseModel):
    code: str
    label: str
    color: str
    rank: int


class KpiSummary(BaseModel):
    device_sn: str | None
    company_name: str | None = None
    location_name: str | None = None
    range_start: datetime | None
    range_end: datetime | None
    record_count: int
    max_feels_like: float | None
    max_temperature: float | None
    avg_humidity: float | None
    avg_feels_like: float | None
    current_level: HeatLevelOut
    # 단계별 임계값(℃) 노출 — 프론트 배지/범례용
    thresholds: dict[str, float]


class GeocodeOut(BaseModel):
    lat: float
    lon: float
    matched: str       # 매칭된 주소(확인용)
    provider: str      # kakao | nominatim
    region_code: str | None = None  # 행정동 코드 — 기기에 저장해 이후 재조회 불필요


class DataRangeOut(BaseModel):
    min_date: str | None
    max_date: str | None
    dates: list[str] = Field(default_factory=list)  # 데이터가 있는 일자 목록(YYYY-MM-DD)


class SeriesPoint(BaseModel):
    t: datetime
    temperature: float | None
    feels_like: float | None
    humidity: float | None


class TimeSeriesOut(BaseModel):
    device_sn: str
    interval_minutes: int
    points: list[SeriesPoint]


# ---------- Weather compare ----------
class CurrentWeatherOut(BaseModel):
    provider: str
    available: bool
    source: str = "케이웨더"               # 데이터 출처 표기
    region: str | None = None
    outdoor_temp: float | None = None
    outdoor_feels: float | None = None
    outdoor_humidity: float | None = None
    outdoor_level: HeatLevelOut | None = None   # 야외 실시간 폭염 위험단계(체감온도 기준)
    observed_at: str | None = None        # 외부 관측 시각
    indoor_feels: float | None = None      # 현장 최신 체감온도
    indoor_temp: float | None = None
    indoor_at: str | None = None           # 현장 최신 측정 시각
    delta: float | None = None             # 현장 체감 - 외부 기온
    enclosed_alert: bool = False
    enclosed_threshold: float = 5.0
    message: str | None = None


class WeatherComparePoint(BaseModel):
    t: datetime
    indoor_feels_like: float | None
    outdoor_temperature: float | None
    outdoor_feels: float | None = None   # 기상청 공식 산식 기반 외부 체감온도
    delta: float | None  # 내부 체감 - 외부 체감(체감 없으면 기온) 차이


class WeatherCompareOut(BaseModel):
    device_sn: str
    provider: str
    interval_minutes: int
    points: list[WeatherComparePoint]
    max_delta: float | None
    enclosed_alert: bool          # 밀폐형 폭염 경고
    enclosed_threshold: float


# ---------- Reports ----------
class DailyReportData(BaseModel):
    device_sn: str
    date: str
    company_name: str | None
    location_name: str | None
    max_feels_like: float | None
    max_feels_like_time: str | None
    max_temperature: float | None
    avg_humidity: float | None
    minutes_over_33: int          # 33℃ 이상 누적 지속(분)
    minutes_over_35: int
    minutes_over_38: int
    peak_level: HeatLevelOut
    guidance: list[str]           # 안전조치 가이드 텍스트
