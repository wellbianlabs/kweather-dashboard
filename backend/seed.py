"""데모 시드 스크립트.

실제 케이웨더 로우데이터가 없으므로 PRD 규격(탭 구분, DATE/TIME/SN/TEMP/HUMI/A-TEMP)의
샘플 CSV 를 생성하여 sample_data/ 에 저장하고, 실제 수집 파이프라인(ingest)으로 적재합니다.

실행:  backend/.venv/Scripts/python.exe backend/seed.py
"""
from __future__ import annotations

import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import Device, Tenant
from app.services import ingest

BASE = Path(__file__).resolve().parent
SAMPLE_DIR = BASE.parent / "sample_data"
DEMO_API_KEY = "demo-key"

# (SN, 회사, 위치, 주소, 위도, 경도, region_code(ASOS), 내부가열 가중치)
# 데모용 SN 은 실제 기기 시리얼(IST...)과 충돌하지 않도록 'DEMO-' 접두사 사용.
DEVICES = [
    ("DEMO-A001", "데모 제강(주)", "제2공장 정련로 앞", "부산 사하구 다대로", 35.0966, 128.9663, "159", 9.0),
    ("DEMO-A002", "데모 제강(주)", "압연공정 라인 B", "부산 사하구 다대로", 35.0970, 128.9670, "159", 6.0),
    ("DEMO-B001", "데모 물류(주)", "옥외 상하차장", "경기 평택시 포승읍", 36.9920, 126.8400, "119", 2.5),
]

START = date(2026, 6, 1)
DAYS = 3
random.seed(42)


def _gen_csv_for_device(sn: str, heat_w: float) -> str:
    lines = ["DATE\tTIME\tSN\tTEMP\tHUMI\tA-TEMP"]
    for d in range(DAYS):
        day = START + timedelta(days=d)
        for minute in range(0, 1440):
            t = datetime.combine(day, datetime.min.time()) + timedelta(minutes=minute)
            hour = t.hour + t.minute / 60.0
            # 일주기: 새벽 저온, 14~15시 고온
            diurnal = math.sin((hour - 9) / 24.0 * 2 * math.pi)
            base_temp = 24.0 + 7.0 * diurnal + heat_w * max(0.0, diurnal)
            temp = base_temp + random.uniform(-0.4, 0.4)
            humi = max(20, min(95, int(70 - 25 * diurnal + random.uniform(-3, 3))))
            # 체감온도: 고온다습 시 실제온도보다 높게
            feels = temp + (humi - 50) * 0.04 + max(0.0, temp - 30) * 0.25
            # 가끔 결측(보간 테스트용)
            if random.random() < 0.002:
                lines.append(f"{day.isoformat()}\t{t.strftime('%H:%M:%S')}\t{sn}\t\t{humi}\t")
            else:
                lines.append(
                    f"{day.isoformat()}\t{t.strftime('%H:%M:%S')}\t{sn}\t{temp:.1f}\t{humi}\t{feels:.1f}"
                )
    return "\n".join(lines)


def main() -> None:
    init_db()
    SAMPLE_DIR.mkdir(exist_ok=True)

    with SessionLocal() as db:
        tenant = db.scalar(select(Tenant).where(Tenant.api_key == DEMO_API_KEY))
        if tenant is None:
            tenant = Tenant(name="데모 사업장", api_key=DEMO_API_KEY)
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        for sn, company, loc, addr, lat, lon, region, heat_w in DEVICES:
            csv_text = _gen_csv_for_device(sn, heat_w)
            # 샘플 CSV 파일 저장 (UI 드래그앤드롭 데모용)
            fpath = SAMPLE_DIR / f"{sn}_{START.isoformat()}.csv"
            fpath.write_text(csv_text, encoding="utf-8")

            # 실제 수집 파이프라인으로 적재
            result = ingest.ingest_csv(db, tenant, fpath.name, csv_text.encode("utf-8"))
            print(f"[{sn}] parsed={result.rows_parsed} inserted={result.rows_inserted} "
                  f"updated={result.rows_updated} skipped={result.rows_skipped}")

            # 메타데이터 채우기
            dev = db.get(Device, sn)
            dev.company_name = company
            dev.location_name = loc
            dev.address = addr
            dev.latitude = lat
            dev.longitude = lon
            dev.region_code = region
            db.commit()

    print(f"\n시드 완료. 샘플 CSV: {SAMPLE_DIR}")
    print("API 키(X-API-Key): demo-key")


if __name__ == "__main__":
    main()
