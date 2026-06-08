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
    """테넌트(또는 특정 기기)의 데이터 일자 범위 — 대시보드 기본 날짜 설정용."""
    from sqlalchemy import func

    sns = _resolve_scope(db, tenant, device_sn)
    if not sns:
        return {"min_date": None, "max_date": None}
    mn, mx = db.execute(
        select(func.min(SensorLog.measured_at), func.max(SensorLog.measured_at))
        .where(SensorLog.device_sn.in_(sns))
    ).one()
    return {
        "min_date": pd.to_datetime(mn).strftime("%Y-%m-%d") if mn else None,
        "max_date": pd.to_datetime(mx).strftime("%Y-%m-%d") if mx else None,
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

    return KpiSummary(
        device_sn=device_sn,
        company_name=meta.company_name if meta else None,
        location_name=meta.location_name if meta else None,
        range_start=df["measured_at"].min().to_pydatetime(),
        range_end=df["measured_at"].max().to_pydatetime(),
        record_count=int(len(df)),
        max_feels_like=round(max_feels, 1),
        max_temperature=round(float(df["temperature"].max()), 1),
        avg_humidity=round(float(df["humidity"].mean()), 1) if df["humidity"].notna().any() else None,
        avg_feels_like=round(float(df["feels_like"].mean()), 1),
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
_GUIDANCE = {
    "danger": [
        "체감온도 38°C 이상 — 옥외작업 원칙적 중지, 불가피 시 시간당 15분 이상 휴식.",
        "냉방·그늘 휴게시설 가동 상태 및 음용수 비치 즉시 확인.",
        "온열질환 의심자 발생 시 즉시 작업 중단 및 응급조치.",
    ],
    "warning": [
        "체감온도 35°C 이상 — 매시간 10~15분 규칙적 휴식 부여.",
        "오후 2~5시 시간대 옥외작업 최소화 및 작업일정 조정.",
        "관리감독자 순회 점검 강화.",
    ],
    "caution": [
        "체감온도 33°C 이상 — 매시간 10분 이상 휴식, 충분한 수분 섭취 독려.",
        "근로자 건강상태 수시 확인.",
    ],
    "attention": [
        "체감온도 31°C 이상 — 폭염 대비 행동요령 게시 및 수분 섭취 안내.",
    ],
    "safe": [
        "특이사항 없음 — 통상적인 안전수칙 유지.",
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
            max_feels_like=None, max_feels_like_time=None, max_temperature=None,
            avg_humidity=None, minutes_over_33=0, minutes_over_35=0, minutes_over_38=0,
            peak_level=_level_out(peak), guidance=_GUIDANCE["safe"],
        )

    idx_max = df["feels_like"].idxmax()
    max_feels = float(df.loc[idx_max, "feels_like"])
    max_time = pd.to_datetime(df.loc[idx_max, "measured_at"]).strftime("%H:%M")
    peak = heat.classify(max_feels)

    # 1분 주기 가정 -> 임계 이상 레코드 수 = 누적 분
    over_33 = int((df["feels_like"] >= settings.HEAT_CAUTION).sum())
    over_35 = int((df["feels_like"] >= settings.HEAT_WARNING).sum())
    over_38 = int((df["feels_like"] >= settings.HEAT_DANGER).sum())

    return DailyReportData(
        device_sn=device_sn, date=on_date.isoformat(),
        company_name=dev.company_name if dev else None,
        location_name=dev.location_name if dev else None,
        max_feels_like=round(max_feels, 1),
        max_feels_like_time=max_time,
        max_temperature=round(float(df["temperature"].max()), 1),
        avg_humidity=round(float(df["humidity"].mean()), 1) if df["humidity"].notna().any() else None,
        minutes_over_33=over_33, minutes_over_35=over_35, minutes_over_38=over_38,
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
