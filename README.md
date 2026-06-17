# 케이웨더 체감온도 데이터 분석 프로그램

케이웨더 체감온도계 단말기의 TXT 로우데이터를 업로드해 사업장·측정기별 체감온도/온도/습도를
분석하고, 폭염 위험단계·법정휴식을 진단하며, 안전관리 리포트(PDF/Excel)를 자동 출력하는 시스템.

---

# 🔧 핸드오프 (2026-06-17) — 후임 작업자 필독

> 본 README 상단 = **현재 상태·재개점**. 하단 「(레거시)」 = PRD 초기 README(React18/Tailwind/Vercel 기준, **구식**).
> 상세 정본은 **[`Doc/`](Doc/README.md)** 폴더 — 특히 **[작업정본 §현행 정본](Doc/작업정본_KW-DASHBOARD.md)** · **[세션앵커 §0](Doc/세션앵커_KW-DASHBOARD.md)** · **[서버구축정본](Doc/서버구축정본.md)**.

## 현재 상태
- **브랜치 `Dev`**(=feature/mantine-migration, origin/Dev). 스택: **React 19 + Mantine 9.3.1 + recharts 3 + react-router 7 + Vite 5** / FastAPI + Jinja2 + xhtml2pdf + PIL.
- **진입점 `/` = `frontend/src/renew/RenewRoot.tsx`**(실앱: 라우팅+인증+실데이터). 페이지=`renew/pages/*`.
- 검증: `cd frontend && npx tsc -b` 0. 데모 로그인="데모 계정으로 둘러보기"(`demo-key`).

## 로컬 실행
```bash
# 백엔드 (포트 4343 — 로컬 vite proxy 기준; 커밋본은 8000)
cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 4343 --reload
# 프론트
cd frontend && npx vite --port 9999 --strictPort --host 0.0.0.0
# → http://localhost:9999/  (백엔드 미기동 시 데이터 비고)
```
> `frontend/vite.config.ts`의 proxy `target`은 **로컬 4343**(미커밋, 세션용). 커밋본은 **8000** 유지.

## 운영 배포 (자체호스팅)
- **https://sts.kweather.co.kr** (Ubuntu20.04·PostgreSQL12·nginx+Let's Encrypt). 접속 `ssh kweather-sts`. 런북=**서버구축정본**.
- ⚠️ **현재 점검상 로그인 차단**: nginx `location ^~ /api/auth/`→503(로그인/가입/데모 진입 불가). 해제=해당 블록 제거+`systemctl reload nginx`(`.bak` 백업 있음).
- ⚠️ **로컬 최신 변경 미배포**: 서버엔 본 세션 프론트/백엔드 변경이 아직 반영 안 됨. 재배포 절차=서버구축정본 §5.2(프론트 `npm run build`→dist **tar+scp**, 백엔드 rsync, `systemctl restart kweather`).

## 🚧 진행 중 — **리포트 디자인 정합(미완)**: 후임 재개 지점
리포트 렌더러 **3종의 섹션 구조가 불일치**(웹만 어긋남) → 사용자 결정 **「풀 8섹션(PDF 기준)으로 통일」**.

| 렌더러 | 파일 | 현재 |
|---|---|---|
| 웹 `WebReport` | `frontend/src/components/ReportPanel.tsx` | **5섹션**(측정결과·위험단계·시간별·법정휴식·안전조치가이드) ← **이걸 8섹션으로 확장해야 함** |
| PDF-전 HTML(일일) | `frontend/src/catalog/dailyReportHtml.ts` | **8섹션**(정합 기준 디자인) |
| 백엔드 PDF | `backend/app/services/report.py` `_DAILY_TEMPLATE` | **8섹션**(= PDF-전 HTML) |

**8섹션 표준**: 1.측정대상개요 2.측정결과요약(표) 3.위험단계별노출(3행표) 4.시간별 5.**내·외부 비교** 6.**종합 분석** 7.조치권고 8.법정휴식.

**재개 절차**:
1. **백엔드 노출**: `analytics.daily_report_data`(→ `_daily_detail` 호출)에는 `external_daily`·`analysis`·`weather`·`hours[].out_feels/outdoor/delta`가 **이미 계산되어 있음**. `schemas.py DailyReportData`에 이 필드들을 추가하고 `daily_report_data` 반환에 포함만 하면 됨(로직 신규 없음).
2. **프론트 타입**: `frontend/src/types.ts DailyReport`에 동일 필드 추가.
3. **WebReport 재작성**: `ReportPanel.tsx WebReport`를 8섹션으로 — **디자인 기준=`catalog/dailyReportHtml.ts`**. 5번(내외부 비교: 표+`HourlyChart` 비교) · 6번(종합분석: `analysis` 리스트) 추가, 섹션 번호 1~8 정렬, 측정결과/위험단계도 PDF의 표 형식으로 맞춤.
4. **기간 보고서도 동일 점검**: `catalog/PeriodicReport.tsx WebPeriodicReport` ↔ `periodicReportHtml.ts` ↔ 백엔드 `_PERIODIC_TEMPLATE` 일치 확인.
5. 검증: 리포트 스튜디오(`/report-studio.html`·`/periodic-report-studio.html`) 2칼럼(웹↔PDF-전 HTML) 좌우 동일 + 실 `/report` 웹↔PDF 미리보기 동일.

> 백엔드 PDF·PDF-전 HTML은 이미 8섹션 정합 상태. **웹 WebReport만 5→8 확장**하면 끝. 데이터는 백엔드에 다 있으니 schema 노출 + WebReport 렌더만 추가.

## 핵심 함정 (재현 주의)
- 리포트 PDF(xhtml2pdf): 페이지번호 `@frame`은 `left/width`+`pt`必(`right`/`px` 실패) · NanumGothic `℃`/`▾` 글리프 없음→`°C`/`▼` · `<img>` width `%`불가→pt · matplotlib 미설치(PIL 경로).
- Mantine 9.3.1: `Grid`는 `gap`(not `gutter`) · `Collapse`는 `expanded`(not `in`).
- 배포: deadsnakes PPA 서버 차단→python-build-standalone · macOS openrsync dist 깨짐→tar+scp.

---

## (레거시) PRD 초기 README

> ⚠️ 아래는 초기(React18/Tailwind/Vercel/Leaflet) 기준 — 현행과 다름. 현재 상태는 위 핸드오프 참조.

케이웨더 폭염온도계(체감온도계)의 탭 구분 CSV 로우데이터를 업로드하여 사업장별 온·습도·체감온도를
시각화하고, 외부 기상 데이터와 비교 분석하며, 안전관리용 리포트(PDF/Excel)를 자동 출력하는
**안전보건 대시보드 솔루션**입니다. (PRD 기반 구현)

## 🌐 라이브 데모

- **대시보드:** https://kweather-dashboard-web.vercel.app
- **API:** https://kweather-dashboard-api.vercel.app/api/health
- 데모 로그인 키(`X-API-Key`): `demo-key`

> **자동 배포(CI/CD):** `main` 브랜치에 push 하면 Vercel이 두 프로젝트를 자동 배포합니다.
> (kweather-dashboard-api → `backend/`, kweather-dashboard-web → `frontend/` 루트 디렉터리)
>
> 배포: 프론트(Vercel 정적) + FastAPI(Vercel Python 서버리스) + Supabase Postgres(`kweather` 스키마).
> 서버리스 용량 한도(250MB) 때문에 PDF의 차트 이미지(matplotlib)는 배포본에서 생략되며(표·안전가이드·Excel은 유지),
> 인터랙티브 차트는 웹 대시보드에서 그대로 제공됩니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts + React-Leaflet |
| Backend | Python **FastAPI** + Pandas + SQLAlchemy |
| Database | **SQLAlchemy ORM** — 기본 SQLite, `DATABASE_URL` 한 줄로 PostgreSQL 전환 |
| Report | matplotlib(차트) + xhtml2pdf(PDF, A4) + openpyxl(Excel) |
| 외부날씨 | 교체형 어댑터 — `mock`(기본) / `kma`(기상청 ASOS) |

> PRD는 PostgreSQL을 명시했으나, 설치 환경 제약(EDB CDN 차단)으로 기본 구동은 SQLite로 합니다.
> 스키마/ORM은 PostgreSQL 스펙 그대로이므로 `backend/.env`의 `DATABASE_URL`만 바꾸면 코드 변경 없이 전환됩니다.

## 빠른 실행

사전 준비: Python 3.12, Node.js (이미 설치됨). 백엔드 의존성과 프론트 `node_modules`도 설치되어 있습니다.

```powershell
# 1) (최초 1회) 샘플 데이터 시드 + 개발 서버 동시 기동
.\start.ps1 -Seed

# 이후에는
.\start.ps1
```

- 대시보드: http://127.0.0.1:5173
- API 서버 / 문서: http://127.0.0.1:8000/docs
- 데모 API 키(`X-API-Key`): `demo-key`

### 수동 실행

```powershell
# 백엔드
cd backend
.\.venv\Scripts\python.exe seed.py                  # 샘플 데이터(최초 1회)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# 프론트엔드 (다른 터미널)
cd frontend
npm run dev
```

### 단일 서버 배포 (선택)

프론트를 빌드하면 FastAPI가 정적 파일까지 함께 서빙합니다(`/`).

```powershell
cd frontend; npm run build      # frontend/dist 생성
cd ..\backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
# -> http://127.0.0.1:8000 단일 진입
```

## 주요 기능 (PRD 매핑)

- **3.1 데이터 수집**: 다중 CSV 드래그앤드롭 / 탭 구분·인코딩(UTF-8·CP949) 자동감지 / 결측 선형보간 /
  (device_sn, measured_at) 기준 Upsert / 청크 처리.
- **3.2 대시보드**: KPI 위젯(최고 체감온도·온도·평균습도·현재 위험단계) / 멀티축 시계열(10·30분 다운샘플링) /
  위경도 기반 위험도 지도(단계별 색상 마커).
- **3.3 외부 날씨 비교**: 기상청 어댑터(mock/kma) / 내부 체감온도 vs 외부 기온 대조 / **밀폐형 폭염 경고**.
- **3.4 리포트**: 일일 보고서(최고시각·33℃↑ 누적분·안전가이드) / 기간 통계 / **PDF(A4)·Excel** 다운로드.
- **6.3 멀티테넌트**: `X-API-Key` 기반 테넌트 격리 — 타 사업장 SN 데이터 접근 차단.

## 폭염 위험 단계 (체감온도 A-TEMP 기준)

| 단계 | 임계 | 색상 |
| --- | --- | --- |
| 관심 | 31℃ | 연두 |
| 주의 | 33℃ | 노랑 |
| 경고 | 35℃ | 주황 |
| 위험 | 38℃ 이상 | 빨강 |

임계값·날씨 제공자 등은 `backend/.env`(템플릿: `.env.example`)에서 조정합니다.

## 입력 CSV 규격

탭(`\t`) 구분, 헤더: `DATE  TIME  SN  TEMP  HUMI  A-TEMP`
샘플 파일은 시드 실행 시 `sample_data/` 에 생성됩니다(드래그앤드롭 테스트용).

## PostgreSQL로 전환

```ini
# backend/.env
DATABASE_URL=postgresql+psycopg2://postgres:비밀번호@localhost:5432/kweather
```
`backend/requirements.txt`의 `psycopg2-binary` 주석 해제 후 재설치하면 됩니다.

## 디렉터리 구조

```
backend/   FastAPI 앱(app/), 서비스(ingest·analytics·weather·report), seed.py
frontend/  React 대시보드 (components/, App.tsx, api.ts)
sample_data/  시드로 생성되는 샘플 CSV
```
