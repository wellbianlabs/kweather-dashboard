# 케이웨더 체감온도계 연동 대시보드 및 리포트 자동화 시스템

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
