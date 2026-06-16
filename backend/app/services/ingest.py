"""측정 로우데이터 수집 엔진 (PRD 3.1).

**케이웨더 체감온도계 TXT 전용** — 타사 기기·임의 포맷 차단을 위해 케이웨더 단말기
고유 포맷만 통과시킨다. CSV 등 다른 형식은 업로드 단계에서 거부한다.

케이웨더 TXT 포맷(헤더 없는 콤마 구분 일자별 로그):
    ``YYYY-MM-DD HH:MM, 체감온도, 온도, 습도,``  (분 단위 시각, 꼬리 콤마)
파일에 기기 식별자가 없으므로 업로드 시 지정한 기기(미지정 시 테넌트 단일 기기)로 연결.

공통:
- UTF-8 / CP949 인코딩 자동 감지
- 결측치: 기기·시간 정렬 후 선형 보간, 그래도 비면 해당 행 제외
- 중복: (device_sn, measured_at) 기준 최신 업로드로 Upsert
- 테넌트 격리: 신규 기기는 업로드 테넌트로 자동 등록, 타 테넌트 소유 기기는 거부
"""
from __future__ import annotations

import io
import re

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Device, SensorLog, Tenant
from ..schemas import UploadResult

CHUNK_ROWS = 50_000


def _detect_encoding(raw: bytes) -> str:
    """UTF-8 우선, 실패 시 CP949(한글 안정)로 폴백."""
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            raw.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return "cp949"  # 마지막 폴백 (replace 로 디코드)


# 케이웨더 단말기 데이터 행: "YYYY-MM-DD HH:MM, 체감, 온도, 습도," (분 단위, 꼬리 콤마 허용)
_TXT_LINE = re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}")
_KW_LINE = re.compile(
    r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}\s*,\s*-?\d*\.?\d*\s*,\s*-?\d*\.?\d*\s*,\s*-?\d*\.?\d*\s*,?\s*$"
)

# 거부 메시지는 포맷을 역추론할 힌트를 남기지 않도록 의도적으로 간결하게 유지.
_FORMAT_ERR = "올바른 측정 데이터 파일이 아닙니다."


def _assert_kweather_txt(text: str) -> None:
    """케이웨더 단말기 고유 포맷인지 엄격 검증. 아니면 ValueError.

    타사 기기·임의 CSV·헤더 포함 파일을 입력 단계에서 차단한다.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        raise ValueError("빈 파일입니다.")

    # 탭 구분(CSV/엑셀 내보내기 등)은 케이웨더 포맷이 아님 → 거부
    if any("\t" in ln for ln in lines[:100]):
        raise ValueError(_FORMAT_ERR)

    # 첫 유효 라인이 'YYYY-MM-DD HH:MM' 으로 시작하지 않으면(헤더/타포맷) 거부
    if not _TXT_LINE.match(lines[0]):
        raise ValueError(_FORMAT_ERR)

    # 케이웨더 라인 패턴 일치 비율이 충분해야 통과(타포맷 혼입 차단)
    matched = sum(1 for ln in lines if _KW_LINE.match(ln))
    if matched == 0 or matched < len(lines) * 0.8:
        raise ValueError(_FORMAT_ERR)


def _parse_txt(text: str, default_sn: str | None) -> pd.DataFrame:
    """헤더 없는 TXT: 시각, 체감온도(A-TEMP), 온도(TEMP), 습도(HUMI), [빈 꼬리].

    컬럼 순서는 실측 파일로 검증됨 — 1열이 기상청 공식 여름 체감온도와 일치(체감온도),
    2열이 건구온도, 3열이 상대습도.
    """
    if not default_sn:
        raise ValueError("업로드할 기기를 선택해 주세요.")
    df = pd.read_csv(
        io.StringIO(text),
        sep=",",
        header=None,
        usecols=[0, 1, 2, 3],
        names=["dt", "feels_like", "temperature", "humidity"],
        dtype=str,
        engine="python",
        skip_blank_lines=True,
    )
    df["measured_at"] = pd.to_datetime(df["dt"].str.strip(), format="%Y-%m-%d %H:%M", errors="coerce")
    df["sn"] = default_sn
    for col in ("temperature", "humidity", "feels_like"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["measured_at"])
    return df[["measured_at", "sn", "temperature", "humidity", "feels_like"]]


def parse_dataframe(raw: bytes, default_sn: str | None = None) -> tuple[pd.DataFrame, str]:
    """바이트 -> 표준화된 DataFrame(measured_at, sn, temperature, humidity, feels_like).

    케이웨더 체감온도계 TXT 포맷만 허용. 다른 포맷이면 ValueError.
    """
    encoding = _detect_encoding(raw)
    text = raw.decode(encoding, errors="replace")
    _assert_kweather_txt(text)
    return _parse_txt(text, default_sn), encoding


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


def ingest_csv(
    db: Session,
    tenant: Tenant,
    filename: str,
    raw: bytes,
    device_sn: str | None = None,
) -> UploadResult:
    errors: list[str] = []
    # 확장자 가드 — 케이웨더 단말기 TXT 전용. .csv 등 다른 형식은 입력 자체를 거부.
    low = (filename or "").lower()
    if low.endswith(".csv") or low.endswith(".xlsx") or low.endswith(".xls"):
        return UploadResult(
            filename=filename, rows_parsed=0, rows_inserted=0, rows_updated=0,
            rows_skipped=0, new_devices=[], encoding="?",
            errors=["지원하지 않는 파일입니다."],
        )
    # 기기 연결: 미지정이면 테넌트에 기기가 1대일 때 자동 사용
    if not device_sn:
        tenant_sns = db.scalars(
            select(Device.device_sn).where(Device.tenant_id == tenant.id)
        ).all()
        if len(tenant_sns) == 1:
            device_sn = tenant_sns[0]
    try:
        df, encoding = parse_dataframe(raw, default_sn=device_sn)
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
