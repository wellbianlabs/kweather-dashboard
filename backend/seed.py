"""데모 시드 스크립트 — 실서비스 수준 데모 데이터.

실제 케이웨더 체감온도계 단말기와 동일한 형태로 데모 데이터를 생성합니다.
- 형식: 주력 TXT(헤더 없는 콤마 구분, 10분 간격) — 실제 수집 파이프라인(ingest)으로 적재
- 체감온도: 기상청 공식 여름철 체감온도 산식(kma_feels_like) 사용
- 기간: 오늘 기준 최근 7일(풀데이) + 오늘 오전(진행 중인 단말기처럼)
- 프로파일: 폭염 단계(관심/주의/경고/위험)가 모두 드러나는 현실적 일주기 + 일자별 상승 추세

실행:  backend/.venv/Scripts/python.exe backend/seed.py
(프로덕션 갱신 시 DATABASE_URL 환경변수로 대상 DB 지정)
"""
from __future__ import annotations

import random
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from datetime import date, datetime, time, timedelta
from math import pi, sin
from pathlib import Path

from sqlalchemy import delete, select

from app.database import SessionLocal, init_db
from app.models import Device, ExternalDailyCache, SensorLog, Tenant
from app.services import ingest
from app.services.weather import kma_feels_like

BASE = Path(__file__).resolve().parent
SAMPLE_DIR = BASE.parent / "sample_data"
DEMO_API_KEY = "demo-key"

# (SN, 회사, 위치, 주소, 위도, 경도, region_code(10자리 행정동 — 앞 2자리로 ASOS 지점 매칭), 야간기준, 진폭, 내부가열)
# 데모용 SN 은 실제 기기 시리얼(IST...)과 충돌하지 않도록 'DEMO-' 접두사 사용.
DEVICES = [
    ("DEMO-A001", "데모 제강(주)", "제2공장 정련로 앞", "부산 사하구 다대로", 35.0966, 128.9663, "2638051000", 28.5, 4.0, 6.5),
    ("DEMO-A002", "데모 제강(주)", "압연공정 라인 B", "부산 사하구 다대로", 35.0970, 128.9670, "2638051000", 27.0, 4.0, 4.0),
    ("DEMO-B001", "데모 물류(주)", "옥외 상하차장", "경기 평택시 포승읍", 36.9920, 126.8400, "4122033000", 23.5, 5.0, 2.5),
]

FULL_DAYS = 7            # 오늘 이전 풀데이 수
TODAY_UNTIL = time(9, 0)  # 오늘 데이터는 오전까지(운영 중 단말기 모사)
# 일자별 폭염 강도(점진 상승 — 기간보고서 추세 데모). 마지막 값이 '오늘'.
DAY_FACTORS = [0.82, 0.88, 0.95, 0.90, 1.00, 1.06, 1.12, 1.05]

random.seed(42)


def _gen_txt_for_day(day: date, night: float, amp: float, heat_w: float, factor: float) -> str:
    """단말기 일자별 로그(TXT): 'YYYY-MM-DD HH:MM, 체감온도, 온도, 습도,' 10분 간격."""
    until = TODAY_UNTIL if day == date.today() else time(23, 50)
    lines: list[str] = []
    t = datetime.combine(day, time(0, 0))
    while t.time() <= until and t.date() == day:
        hour = t.hour + t.minute / 60.0
        # 일주기: 새벽(03시) 저온, 한낮(15시) 고온
        diurnal = sin((hour - 9) / 24.0 * 2 * pi)
        temp = night + (amp * diurnal + heat_w * max(0.0, diurnal)) * factor + random.uniform(-0.35, 0.35)
        humi = max(30.0, min(90.0, 62.0 - 18.0 * diurnal * factor + random.uniform(-2.5, 2.5)))
        feels = kma_feels_like(temp, humi)
        if random.random() < 0.003:  # 드문 결측(보간 데모)
            lines.append(f"{day.isoformat()} {t.strftime('%H:%M')},  , {temp:.1f},{humi:.1f},")
        else:
            lines.append(f"{day.isoformat()} {t.strftime('%H:%M')}, {feels:.1f}, {temp:.1f},{humi:.1f},")
        t += timedelta(minutes=10)
    return "\n".join(lines) + "\n"


def main() -> None:
    init_db()
    today = date.today()
    days = [today - timedelta(days=FULL_DAYS - i) for i in range(FULL_DAYS)] + [today]

    with SessionLocal() as db:
        tenant = db.scalar(select(Tenant).where(Tenant.api_key == DEMO_API_KEY))
        if tenant is None:
            tenant = Tenant(name="데모 사업장", api_key=DEMO_API_KEY)
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        demo_sns = [d[0] for d in DEVICES]
        # 데모 데이터 전면 갱신: 기존 로그·외부 캐시 삭제(데모 기기 한정)
        db.execute(delete(SensorLog).where(SensorLog.device_sn.in_(demo_sns)))
        db.execute(delete(ExternalDailyCache).where(ExternalDailyCache.device_sn.in_(demo_sns)))
        db.commit()

        for sn, company, loc, addr, lat, lon, region, night, amp, heat_w in DEVICES:
            dev_dir = SAMPLE_DIR / sn
            dev_dir.mkdir(parents=True, exist_ok=True)
            total = 0
            for day, factor in zip(days, DAY_FACTORS[-len(days):]):
                txt = _gen_txt_for_day(day, night, amp, heat_w, factor)
                fname = f"{day.strftime('%Y%m%d')}.TXT"
                (dev_dir / fname).write_text(txt, encoding="utf-8")
                result = ingest.ingest_csv(db, tenant, fname, txt.encode("utf-8"), device_sn=sn)
                total += result.rows_inserted + result.rows_updated
                if result.errors:
                    print(f"[{sn}] {fname} 오류: {result.errors}")
            print(f"[{sn}] {len(days)}일 적재 — {total}건")

            # 메타데이터 채우기
            dev = db.get(Device, sn)
            dev.company_name = company
            dev.location_name = loc
            dev.address = addr
            dev.latitude = lat
            dev.longitude = lon
            dev.region_code = region
            db.commit()

    print(f"\n시드 완료. 샘플 TXT: {SAMPLE_DIR}")
    print("API 키(X-API-Key): demo-key")


if __name__ == "__main__":
    main()
