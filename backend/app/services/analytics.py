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
# 고용노동부 「온열질환 예방가이드」 및 산업안전보건기준에 관한 규칙 제566조에 따른 단계별 조치
_GUIDANCE = {
    "danger": [
        "(작업 중지) 긴급조치 작업을 제외한 옥외작업의 원칙적 중지 및 실내 무더위 작업 최소화",
        "(휴식) 매시간 15분 이상 휴식 부여, 작업 전 근로자 건강상태 확인 의무화",
        "(응급대응) 온열질환 의심 증상 발생 시 즉시 작업 중단, 시원한 장소 이송 및 119 신고체계 가동",
        "(점검) 냉방·통풍 설비 및 그늘 휴게시설 가동 상태, 음용수 비치 여부 즉시 점검",
    ],
    "warning": [
        "(작업 조정) 무더위 시간대(14~17시) 불요불급한 옥외작업 중지, 작업시간 조기·야간 전환 검토",
        "(휴식) 매시간 15분 이상 그늘진 장소에서 규칙적 휴식 부여",
        "(관리감독) 관리감독자 순회점검 강화 및 2인 1조 작업 운영",
    ],
    "caution": [
        "(휴식) 매시간 10분 이상 휴식 부여 및 충분한 음용수 섭취 지도",
        "(건강관리) 온열질환 민감군(고령자·기저질환자) 작업배치 조정 및 건강상태 수시 확인",
        "(작업 검토) 무더위 시간대 옥외작업 단축 검토",
    ],
    "attention": [
        "(예방수칙) 온열질환 예방 3대 기본수칙(물·그늘·휴식) 이행체계 점검",
        "(안내) 폭염 대비 근로자 행동요령 게시 및 전파, 음용수·그늘 휴게장소 사전 확보",
    ],
    "safe": [
        "(통상관리) 폭염 위험단계 미해당 — 통상적인 안전보건 관리체계 유지",
        "(대비) 폭염 발생 대비 음용수·휴게시설 등 예방 인프라 사전 점검 권고",
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
