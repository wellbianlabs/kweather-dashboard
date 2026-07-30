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
    is_admin: bool = False  # 관리자 대시보드 접근 가능 여부
    is_demo: bool = False   # 공용 데모(읽기 전용) 계정 여부


class ProfileUpdateIn(BaseModel):
    """회원정보 수정 — 모든 필드 선택. 비밀번호 변경 시 current/new 동시 필요."""
    email: str | None = None
    company_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None


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
    max_feels_like_time: str | None = None   # 최고 체감온도 발생 시각
    max_temperature: float | None
    max_temperature_time: str | None = None  # 최고 온도 발생 시각
    avg_humidity: float | None
    avg_feels_like: float | None
    danger_minutes: int = 0                  # 위험단계(체감 38℃ 이상) 누적 지속(분)
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
    outdoor_humidity: float | None = None  # 기상청 습도(시간별 캐시 hm)
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
class DailyHourPoint(BaseModel):
    hour: int                     # 0~23 (시)
    feels: float | None           # 시간 평균 체감온도
    temperature: float | None = None
    level: str                    # 위험 단계 code
    color: str                    # 단계 색상(헥스)


class DailyReportData(BaseModel):
    device_sn: str
    date: str
    company_name: str | None
    location_name: str | None
    address: str | None = None
    max_feels_like: float | None
    max_feels_like_time: str | None
    max_temperature: float | None
    avg_humidity: float | None
    minutes_over_31: int = 0      # 31℃ 이상 누적 지속(분) — 관심
    minutes_over_33: int          # 33℃ 이상 — 주의
    minutes_over_35: int          # 35℃ 이상 — 경고
    minutes_over_38: int          # 38℃ 이상 — 위험
    hours: list[DailyHourPoint] = []  # 시간별 체감온도 변화
    # 법정 휴식 의무(산업안전보건규칙 — 체감 33℃↑ 작업 시 2시간마다 20분 이상)
    work_hot_minutes: int = 0     # 근무시간(09~18) 중 체감 33℃ 이상 작업 누적(분)
    legal_rest_count: int = 0     # 법정 최소 휴식 횟수
    legal_rest_minutes: int = 0   # 법정 최소 휴식 총시간(분)
    peak_level: HeatLevelOut
    guidance: list[str]           # 안전조치 가이드 텍스트
