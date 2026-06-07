"""CSV(Tab 구분) 로우데이터 수집 엔진 (PRD 3.1).

- 탭 구분자 인식
- UTF-8 / CP949 인코딩 자동 감지
- 결측치: 기기·시간 정렬 후 선형 보간, 그래도 비면 해당 행 제외
- 중복: (device_sn, measured_at) 기준 최신 업로드로 Upsert
- 대용량: 청크 단위 파싱 + 배치 Upsert (OOM 방지, PRD 6.2)
- 테넌트 격리: 신규 SN 은 업로드 테넌트로 자동 등록, 타 테넌트 소유 SN 은 거부
"""
from __future__ import annotations

import io
from typing import Iterable

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Device, SensorLog, Tenant
from ..schemas import UploadResult

CHUNK_ROWS = 50_000

# 원본 컬럼명 -> 표준 키 (대소문자/구분자 변형 허용)
_COLUMN_ALIASES = {
    "DATE": "date",
    "TIME": "time",
    "SN": "sn",
    "TEMP": "temperature",
    "HUMI": "humidity",
    "A-TEMP": "feels_like",
    "A_TEMP": "feels_like",
    "ATEMP": "feels_like",
}
_REQUIRED = {"date", "time", "sn", "temperature", "feels_like"}


def _detect_encoding(raw: bytes) -> str:
    """UTF-8 우선, 실패 시 CP949(한글 안정)로 폴백."""
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            raw.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return "cp949"  # 마지막 폴백 (replace 로 디코드)


def _normalize_columns(cols: Iterable[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for c in cols:
        key = str(c).strip().upper().replace(" ", "")
        if key in _COLUMN_ALIASES:
            mapping[c] = _COLUMN_ALIASES[key]
    return mapping


def parse_dataframe(raw: bytes) -> tuple[pd.DataFrame, str]:
    """바이트 -> 표준화된 DataFrame(measured_at, sn, temperature, humidity, feels_like)."""
    encoding = _detect_encoding(raw)
    text = raw.decode(encoding, errors="replace")

    df = pd.read_csv(
        io.StringIO(text),
        sep="\t",
        dtype=str,
        engine="python",
        skip_blank_lines=True,
    )
    df.columns = [str(c).strip() for c in df.columns]
    rename = _normalize_columns(df.columns)
    df = df.rename(columns=rename)

    missing = _REQUIRED - set(df.columns)
    if missing:
        raise ValueError(
            f"필수 컬럼 누락: {sorted(missing)} (인식된 컬럼: {list(df.columns)})"
        )

    # 타입 변환
    df["measured_at"] = pd.to_datetime(
        df["date"].str.strip() + " " + df["time"].str.strip(),
        format="%Y-%m-%d %H:%M:%S",
        errors="coerce",
    )
    df["sn"] = df["sn"].str.strip()
    for col in ("temperature", "humidity", "feels_like"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            df[col] = pd.NA

    df = df.dropna(subset=["measured_at", "sn"])
    df = df[["measured_at", "sn", "temperature", "humidity", "feels_like"]]
    return df, encoding


def _interpolate_and_clean(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """기기·시간 정렬 후 선형 보간. 핵심 지표가 여전히 결측이면 행 제외."""
    before = len(df)
    df = df.sort_values(["sn", "measured_at"])
    df[["temperature", "feels_like", "humidity"]] = (
        df.groupby("sn")[["temperature", "feels_like", "humidity"]]
        .apply(lambda g: g.interpolate(method="linear", limit_direction="both"))
        .reset_index(drop=True)
    )
    # 보간 후에도 온도/체감온도가 비면 제외
    df = df.dropna(subset=["temperature", "feels_like"])
    df["humidity"] = df["humidity"].round().astype("Int64")
    skipped = before - len(df)
    return df, skipped


def ingest_csv(db: Session, tenant: Tenant, filename: str, raw: bytes) -> UploadResult:
    errors: list[str] = []
    try:
        df, encoding = parse_dataframe(raw)
    except Exception as exc:  # noqa: BLE001
        return UploadResult(
            filename=filename, rows_parsed=0, rows_inserted=0, rows_updated=0,
            rows_skipped=0, new_devices=[], encoding="?", errors=[str(exc)],
        )

    parsed = len(df)
    df, skipped = _interpolate_and_clean(df)

    # --- 기기(SN) 등록 / 테넌트 격리 가드 ---
    new_devices: list[str] = []
    sns = sorted(df["sn"].unique().tolist())
    existing = {
        d.device_sn: d
        for d in db.scalars(select(Device).where(Device.device_sn.in_(sns)))
    }
    blocked: set[str] = set()
    for sn in sns:
        dev = existing.get(sn)
        if dev is None:
            db.add(Device(device_sn=sn, tenant_id=tenant.id))
            new_devices.append(sn)
        elif dev.tenant_id != tenant.id:
            blocked.add(sn)
            errors.append(f"SN {sn}: 다른 테넌트 소유 기기이므로 건너뜀")
    if blocked:
        df = df[~df["sn"].isin(blocked)]
    db.flush()

    inserted, updated = _upsert_logs(db, df)
    db.commit()

    # 대시보드 자동 이동용: 파일에 포함된 기기/일자 범위
    affected = sorted(df["sn"].unique().tolist()) if not df.empty else []
    min_date = max_date = None
    if not df.empty:
        min_date = df["measured_at"].min().strftime("%Y-%m-%d")
        max_date = df["measured_at"].max().strftime("%Y-%m-%d")

    return UploadResult(
        filename=filename,
        rows_parsed=parsed,
        rows_inserted=inserted,
        rows_updated=updated,
        rows_skipped=skipped,
        new_devices=new_devices,
        affected_devices=affected,
        min_date=min_date,
        max_date=max_date,
        encoding=encoding,
        errors=errors,
    )


def _upsert_logs(db: Session, df: pd.DataFrame) -> tuple[int, int]:
    """고속 벌크 Upsert.

    행 단위 ORM 업데이트(수천 회 왕복) 대신 DB 네이티브
    ``INSERT ... ON CONFLICT (device_sn, measured_at) DO UPDATE`` 를 배치로 실행한다.
    대용량 파일도 서버리스 시간제한 내에 처리되도록 왕복 횟수를 최소화한다.
    """
    if df.empty:
        return 0, 0

    # 레코드 변환 + 파일 내 (sn, measured_at) 중복 제거 (마지막 값 우선)
    dedup: dict[tuple, dict] = {}
    for r in df.to_dict("records"):
        mt = r["measured_at"].to_pydatetime()
        dedup[(r["sn"], mt)] = {
            "device_sn": r["sn"],
            "measured_at": mt,
            "temperature": float(r["temperature"]),
            "humidity": None if pd.isna(r["humidity"]) else int(r["humidity"]),
            "feels_like_temperature": float(r["feels_like"]),
        }
    records = list(dedup.values())
    total = len(records)

    # inserted/updated 집계: 기기별 시간범위 1회 인덱스 조회로 기존 키 파악
    by_dev: dict[str, list] = {}
    for rec in records:
        by_dev.setdefault(rec["device_sn"], []).append(rec["measured_at"])
    updated = 0
    for sn, times in by_dev.items():
        existing = set(
            db.scalars(
                select(SensorLog.measured_at).where(
                    SensorLog.device_sn == sn,
                    SensorLog.measured_at >= min(times),
                    SensorLog.measured_at <= max(times),
                )
            )
        )
        if existing:
            updated += sum(1 for t in times if t in existing)
    inserted = total - updated

    # DB 방언별 네이티브 upsert
    dialect = db.bind.dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:
        _insert = None

    BATCH = 1000
    if _insert is not None:
        for i in range(0, total, BATCH):
            batch = records[i : i + BATCH]
            stmt = _insert(SensorLog).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["device_sn", "measured_at"],
                set_={
                    "temperature": stmt.excluded.temperature,
                    "humidity": stmt.excluded.humidity,
                    "feels_like_temperature": stmt.excluded.feels_like_temperature,
                },
            )
            db.execute(stmt)
    else:
        # 폴백(기타 방언): 기존 키 삭제 후 일괄 삽입
        for sn, times in by_dev.items():
            db.query(SensorLog).filter(
                SensorLog.device_sn == sn,
                SensorLog.measured_at.in_(times),
            ).delete(synchronize_session=False)
        db.bulk_insert_mappings(SensorLog, records)

    db.flush()
    return inserted, updated
