"""분석 엔진 (PRD 3.2 / 3.4).

DB 로그를 pandas 로 올려 KPI, 다운샘플링 시계열, 지도 마커, 일일/기간 통계를 산출.
"""
from __future__ import annotations

from datetime import date as date_cls, datetime, time, timedelta

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import heat
from ..config import settings
from ..models import Device, SensorLog, Tenant
from ..schemas import (
    DailyHourPoint,
    DailyReportData,
    HeatLevelOut,
    KpiSummary,
    SeriesPoint,
    TimeSeriesOut,
)


def _level_out(level: heat.HeatLevel) -> HeatLevelOut:
    return HeatLevelOut(code=level.code, label=level.label, color=level.color, rank=level.rank)


def _tenant_device_sns(db: Session, tenant: Tenant) -> list[str]:
    return list(db.scalars(select(Device.device_sn).where(Device.tenant_id == tenant.id)))


def load_logs(
    db: Session,
    device_sns: list[str],
    start: datetime | None = None,
    end: datetime | None = None,
) -> pd.DataFrame:
    if not device_sns:
        return pd.DataFrame(columns=["measured_at", "device_sn", "temperature", "humidity", "feels_like"])
    stmt = select(
        SensorLog.measured_at,
        SensorLog.device_sn,
        SensorLog.temperature,
        SensorLog.humidity,
        SensorLog.feels_like_temperature,
    ).where(SensorLog.device_sn.in_(device_sns))
    if start is not None:
        stmt = stmt.where(SensorLog.measured_at >= start)
    if end is not None:
        stmt = stmt.where(SensorLog.measured_at <= end)
    stmt = stmt.order_by(SensorLog.measured_at)

    rows = db.execute(stmt).all()
    df = pd.DataFrame(rows, columns=["measured_at", "device_sn", "temperature", "humidity", "feels_like"])
    if not df.empty:
        df["measured_at"] = pd.to_datetime(df["measured_at"])
        for c in ("temperature", "humidity", "feels_like"):
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def data_range(db: Session, tenant: Tenant, device_sn: str | None) -> dict:
    """테넌트(또는 특정 기기)의 데이터 일자 범위 + 데이터가 있는 날짜 목록.

    리포트 기간(바운더리)과 대시보드 날짜 드롭다운 구성에 사용.
    """
    from sqlalchemy import Date, cast, distinct, func

    sns = _resolve_scope(db, tenant, device_sn)
    if not sns:
        return {"min_date": None, "max_date": None, "dates": []}

    mn, mx = db.execute(
        select(func.min(SensorLog.measured_at), func.max(SensorLog.measured_at))
        .where(SensorLog.device_sn.in_(sns))
    ).one()

    # 데이터가 존재하는 distinct 일자 (방언 호환: 라벨 + 인덱스 접근)
    date_expr = (
        func.date(SensorLog.measured_at)
        if db.bind.dialect.name == "sqlite"
        else cast(SensorLog.measured_at, Date)
    ).label("d")
    rows = db.execute(
        select(date_expr).where(SensorLog.device_sn.in_(sns)).distinct()
    ).all()
    dates = sorted({pd.to_datetime(r[0]).strftime("%Y-%m-%d") for r in rows if r[0] is not None})

    return {
        "min_date": pd.to_datetime(mn).strftime("%Y-%m-%d") if mn else None,
        "max_date": pd.to_datetime(mx).strftime("%Y-%m-%d") if mx else None,
        "dates": dates,
    }


def _resolve_scope(db: Session, tenant: Tenant, device_sn: str | None) -> list[str]:
    """device_sn 이 주어지면 테넌트 소유 검증 후 단일, 아니면 전체 기기."""
    owned = _tenant_device_sns(db, tenant)
    if device_sn:
        if device_sn not in owned:
            return []
        return [device_sn]
    return owned


# ---------------- KPI ----------------
def kpi_summary(
    db: Session, tenant: Tenant, device_sn: str | None, start: datetime | None, end: datetime | None
) -> KpiSummary:
    sns = _resolve_scope(db, tenant, device_sn)
    df = load_logs(db, sns, start, end)

    meta = None
    if device_sn:
        meta = db.get(Device, device_sn)

    if df.empty:
        return KpiSummary(
            device_sn=device_sn,
            company_name=meta.company_name if meta else None,
            location_name=meta.location_name if meta else None,
            range_start=start, range_end=end, record_count=0,
            max_feels_like=None, max_temperature=None, avg_humidity=None, avg_feels_like=None,
            current_level=_level_out(heat.classify(None)),
            thresholds=heat.thresholds(),
        )

    max_feels = float(df["feels_like"].max())
    # 위험 단계 = 선택 기간 내 '최고 체감온도' 기준 (안전관리 목적상 최악값 노출, 지도 마커와 일관)
    current = heat.classify(max_feels)

    rng_start = df["measured_at"].min().to_pydatetime()
    rng_end = df["measured_at"].max().to_pydatetime()
    same_day = rng_start.date() == rng_end.date()

    def _at(idx) -> str:
        t = pd.to_datetime(df.loc[idx, "measured_at"])
        return t.strftime("%H:%M" if same_day else "%m-%d %H:%M")

    max_feels_time = _at(df["feels_like"].idxmax())
    max_temp_time = _at(df["temperature"].idxmax())

    # 위험단계(체감 38℃ 이상) 누적 지속시간 — 측정 간격(중앙값)을 곱해 분으로 환산.
    # (데이터가 10분 주기 등 비1분일 때도 실제 시간에 가깝게 추정)
    ts = df["measured_at"].sort_values()
    diffs = ts.diff().dropna().dt.total_seconds() / 60.0
    step = float(diffs.median()) if len(diffs) else 1.0
    if not step or step <= 0 or step > 60:
        step = 1.0
    danger_records = int((df["feels_like"] >= settings.HEAT_DANGER).sum())
    danger_minutes = int(round(danger_records * step))

    return KpiSummary(
        device_sn=device_sn,
        company_name=meta.company_name if meta else None,
        location_name=meta.location_name if meta else None,
        range_start=rng_start,
        range_end=rng_end,
        record_count=int(len(df)),
        max_feels_like=round(max_feels, 1),
        max_feels_like_time=max_feels_time,
        max_temperature=round(float(df["temperature"].max()), 1),
        max_temperature_time=max_temp_time,
        avg_humidity=round(float(df["humidity"].mean()), 1) if df["humidity"].notna().any() else None,
        avg_feels_like=round(float(df["feels_like"].mean()), 1),
        danger_minutes=danger_minutes,
        current_level=_level_out(current),
        thresholds=heat.thresholds(),
    )


# ---------------- Time series (downsampled) ----------------
def time_series(
    db: Session, tenant: Tenant, device_sn: str, start: datetime | None, end: datetime | None, interval: int
) -> TimeSeriesOut:
    sns = _resolve_scope(db, tenant, device_sn)
    df = load_logs(db, sns, start, end)
    if df.empty:
        return TimeSeriesOut(device_sn=device_sn, interval_minutes=interval, points=[])

    s = (
        df.set_index("measured_at")[["temperature", "feels_like", "humidity"]]
        .resample(f"{interval}min")
        .mean()
        .dropna(how="all")
    )
    points = [
        SeriesPoint(
            t=idx.to_pydatetime(),
            temperature=None if pd.isna(r["temperature"]) else round(float(r["temperature"]), 2),
            feels_like=None if pd.isna(r["feels_like"]) else round(float(r["feels_like"]), 2),
            humidity=None if pd.isna(r["humidity"]) else round(float(r["humidity"]), 1),
        )
        for idx, r in s.iterrows()
    ]
    return TimeSeriesOut(device_sn=device_sn, interval_minutes=interval, points=points)


# ---------------- Daily report ----------------
# 권고 문구 — 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」(2026.5.13.) 반영.
# 체감온도 33°C 이상 작업 시 '2시간마다 20분 이상 휴식'은 산업안전보건규칙 개정('25.7.17.)으로
# 법제화된 사업주 보건조치. 38°C 이상은 기상청 신설 '폭염중대경보' 기준.
_GUIDANCE = {
    "danger": [
        "(작업 중지) 폭염중대경보(체감 38°C 이상) 기준 — 긴급조치 작업을 제외한 옥외작업 원칙적 중지",
        "(휴식) 체감온도 33°C 이상 작업 시 2시간마다 20분 이상 휴식 부여(법적 의무), 작업 전 건강상태 확인",
        "(응급대응) 온열질환 의심 증상 발생 시 즉시 작업 중단, 시원한 장소 이송 및 119 신고체계 가동",
        "(점검) 냉방장치·그늘 휴게시설 가동 상태, 시원한 물·개인 보냉장구 비치 여부 즉시 점검",
    ],
    "warning": [
        "(작업 중지) 폭염경보(체감 35°C 이상) 기준 — 무더위 시간대(14~17시) 옥외작업 중지, 작업시간 조기·야간 전환",
        "(휴식) 체감온도 33°C 이상 작업 시 2시간마다 20분 이상 휴식 부여(법적 의무)",
        "(관리감독) 관리감독자 순회점검 강화 및 2인 1조 작업 운영",
    ],
    "caution": [
        "(작업 조정) 폭염주의보(체감 33°C 이상) 기준 — 작업시간대 조정 또는 옥외작업 단축",
        "(휴식) 체감온도 33°C 이상 작업 시 2시간마다 20분 이상 휴식 부여(법적 의무) 및 충분한 음용수 섭취 지도",
        "(건강관리) 온열질환 민감군(고령자·기저질환자) 작업배치 조정 및 건강상태 수시 확인",
    ],
    "attention": [
        "(예방수칙) 폭염안전 5대 기본수칙(시원한 물·냉방장치·휴식·보냉장구·119 신고) 이행체계 점검",
        "(안내) 폭염 대비 근로자 행동요령 게시 및 전파, 음용수·그늘 휴게장소 사전 확보",
    ],
    "safe": [
        "(통상관리) 폭염 위험단계 미해당 — 통상적인 안전보건 관리체계 유지",
        "(대비) 폭염 발생 대비 음용수·냉방·휴게시설 등 예방 인프라 사전 점검 권고",
    ],
}


def daily_report_data(db: Session, tenant: Tenant, device_sn: str, on_date: date_cls) -> DailyReportData:
    if device_sn not in _tenant_device_sns(db, tenant):
        raise ValueError("해당 기기에 접근 권한이 없습니다.")
    dev = db.get(Device, device_sn)
    start = datetime.combine(on_date, time.min)
    end = datetime.combine(on_date, time.max)
    df = load_logs(db, [device_sn], start, end)

    if df.empty:
        peak = heat.classify(None)
        return DailyReportData(
            device_sn=device_sn, date=on_date.isoformat(),
            company_name=dev.company_name if dev else None,
            location_name=dev.location_name if dev else None,
            address=dev.address if dev else None,
            max_feels_like=None, max_feels_like_time=None, max_temperature=None,
            avg_humidity=None, minutes_over_31=0, minutes_over_33=0, minutes_over_35=0,
            minutes_over_38=0, hours=[],
            peak_level=_level_out(peak), guidance=_GUIDANCE["safe"],
        )

    idx_max = df["feels_like"].idxmax()
    max_feels = float(df.loc[idx_max, "feels_like"])
    max_time = pd.to_datetime(df.loc[idx_max, "measured_at"]).strftime("%H:%M")
    peak = heat.classify(max_feels)

    # 측정 간격(중앙값)을 반영해 누적 노출시간(분) 환산 — 대시보드 KPI 와 일관
    ts = df["measured_at"].sort_values()
    diffs = ts.diff().dropna().dt.total_seconds() / 60.0
    step = float(diffs.median()) if len(diffs) else 1.0
    if not step or step <= 0 or step > 60:
        step = 1.0

    def _minutes(thr: float) -> int:
        return int(round(int((df["feels_like"] >= thr).sum()) * step))

    over_31 = _minutes(settings.HEAT_ATTENTION)
    over_33 = _minutes(settings.HEAT_CAUTION)
    over_35 = _minutes(settings.HEAT_WARNING)
    over_38 = _minutes(settings.HEAT_DANGER)

    # 법정 휴식 의무 — 근무시간(09~18) 중 체감 33℃ 이상 작업에 '2시간마다 20분 이상'
    # (산업안전보건규칙). 휴식 부여 여부는 측정되지 않으므로 '부여해야 할 최소 의무량'을 산정.
    whrs = df["measured_at"].dt.hour
    wdf = df[(whrs >= 9) & (whrs < 18)]
    work_hot_minutes = int(round(int((wdf["feels_like"] >= settings.HEAT_CAUTION).sum()) * step)) if not wdf.empty else 0
    legal_rest_count = work_hot_minutes // 120  # 작업 2시간(120분)마다 1회
    legal_rest_minutes = legal_rest_count * 20

    # 시간별 평균(체감/온도) -> 단계 색상
    hourly = (
        df.set_index("measured_at")[["feels_like", "temperature"]]
        .resample("1h").mean()
    )
    hours = []
    for tstamp, row in hourly.iterrows():
        f = None if pd.isna(row["feels_like"]) else round(float(row["feels_like"]), 1)
        t = None if pd.isna(row["temperature"]) else round(float(row["temperature"]), 1)
        lv = heat.classify(f)
        hours.append(DailyHourPoint(hour=int(tstamp.hour), feels=f, temperature=t, level=lv.code, color=lv.color))

    return DailyReportData(
        device_sn=device_sn, date=on_date.isoformat(),
        company_name=dev.company_name if dev else None,
        location_name=dev.location_name if dev else None,
        max_feels_like=round(max_feels, 1),
        max_feels_like_time=max_time,
        max_temperature=round(float(df["temperature"].max()), 1),
        avg_humidity=round(float(df["humidity"].mean()), 1) if df["humidity"].notna().any() else None,
        minutes_over_31=over_31, minutes_over_33=over_33, minutes_over_35=over_35, minutes_over_38=over_38,
        hours=hours,
        work_hot_minutes=work_hot_minutes, legal_rest_count=legal_rest_count, legal_rest_minutes=legal_rest_minutes,
        peak_level=_level_out(peak), guidance=_GUIDANCE[peak.code],
    )


# ---------------- Periodic (weekly/monthly) stats ----------------
def periodic_stats(
    db: Session, tenant: Tenant, device_sn: str | None, start: date_cls, end: date_cls
) -> dict:
    sns = _resolve_scope(db, tenant, device_sn)
    df = load_logs(
        db, sns, datetime.combine(start, time.min), datetime.combine(end, time.max)
    )
    result = {
        "device_sn": device_sn,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "daily": [],
        "level_counts": {k: 0 for k in heat.LEVELS},
        "overall_max_feels": None,
        "overall_avg_feels": None,
    }
    if df.empty:
        return result

    df["day"] = df["measured_at"].dt.date
    for day, g in df.groupby("day"):
        peak = heat.classify(float(g["feels_like"].max()))
        result["daily"].append(
            {
                "date": day.isoformat(),
                "max_feels": round(float(g["feels_like"].max()), 1),
                "avg_feels": round(float(g["feels_like"].mean()), 1),
                "max_temp": round(float(g["temperature"].max()), 1),
                "avg_humidity": round(float(g["humidity"].mean()), 1) if g["humidity"].notna().any() else None,
                "minutes_over_33": int((g["feels_like"] >= settings.HEAT_CAUTION).sum()),
                "peak_level": peak.code,
                "peak_label": peak.label,
            }
        )
        result["level_counts"][peak.code] += 1

    result["overall_max_feels"] = round(float(df["feels_like"].max()), 1)
    result["overall_avg_feels"] = round(float(df["feels_like"].mean()), 1)
    return result
