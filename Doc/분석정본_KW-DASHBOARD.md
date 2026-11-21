# 케이웨더 체감온도계 대시보드 — 분석 정본 (Master Analysis)

> 대상 리포지터리: `wellbianlabs/kweather-dashboard`
> 분석 기준일: **2026-06-16** (라이브 환경 실측 포함)
> 분석 범위: 구조도 · 배포 현황 · 배선(연결)된 항목 · 배선되지 않은 항목 · 문서/현실 불일치 · 데드코드
> 리포지터리 상태: 커밋 62개, 2026-06-04 ~ 2026-06-16 (단일 `main` 브랜치, 약 2주 집중 개발)

---

## 0. 한눈에 보는 결론 (Executive Summary)

| 구분 | 상태 |
| --- | --- |
| **라이브 서비스** | ✅ 정상 가동 (웹 HTTP 200 / API health "ok") |
| **실제 백엔드 DB** | **PostgreSQL (Supabase)** — README 기본값 SQLite 와 다름 |
| **실제 날씨 공급자** | **`kweather` (Air365 Open API)** — README 스택표의 `mock`/`kma` 가 아님 |
| **외부 키 주입 현황** | KW_API_KEY ✅ · KMA_API_KEY ✅ · KAKAO_REST_KEY ✅ (3종 모두 설정됨) |
| **API 엔드포인트** | 21개 정의 — 20개 프런트 배선 / **1개 미배선(`/api/weather/current`)** |
| **README가 약속한 '지도'** | ❌ **미구현** — leaflet 의존성 없음, 지도 컴포넌트 없음 |
| **데드코드** | 백엔드 2개 함수 + 프런트 미사용 아이콘 3개 |
| **환경변수 템플릿(.env.example)** | ⚠️ 실배포와 불일치(구버전) |

핵심 메시지: **제품 기능 자체는 README가 묘사한 것보다 더 깊고 완성도 높게 배선되어 있다.** 단,
(1) "위경도 기반 위험도 지도"는 문서에만 존재하고 코드엔 없으며,
(2) "현재 외부 날씨(`/api/weather/current`)"는 백엔드까지 완성·배포되었으나 **UI에 연결되지 않은 고아 엔드포인트**이고,
(3) 일부 문서(README 스택표 · `.env.example`)가 실제 배포 구성을 따라오지 못한 상태다.

---

## 1. 시스템 구조도

### 1.1 배포 토폴로지 (2개의 독립 Vercel 프로젝트)

```
                    ┌─────────────────────────────────────────────┐
   사용자 브라우저  │  https://kweather-dashboard-web.vercel.app   │
        │           │  Vercel 정적 호스팅 (framework: vite)        │
        │  ①정적    │  - dist/ (React 빌드 산출물)                  │
        ├──────────▶│  - rewrites: /(.*) → /index.html  (SPA)      │
        │           │  - 번들에 VITE_API_BASE 가 '하드코딩'됨 ↓    │
        │           └─────────────────────────────────────────────┘
        │                              │
        │  ②XHR/fetch (Cross-Origin, X-API-Key 헤더)
        │  BASE = https://kweather-dashboard-api.vercel.app
        ▼                              ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  https://kweather-dashboard-api.vercel.app                    │
   │  Vercel Python 서버리스 (region: icn1, maxDuration: 60s)      │
   │  - api/index.py → FastAPI(app.main:app) (ASGI)                │
   │  - rewrites: /(.*) → /api/index   (모든 경로를 FastAPI 로)    │
   │  - CORS: allow_origins=["*"]                                  │
   └──────────────────────────────────────────────────────────────┘
        │                │                         │
        │psycopg2        │httpx                     │httpx
        ▼                ▼                         ▼
   ┌──────────┐   ┌──────────────────┐   ┌────────────────────┐
   │ Supabase │   │ 케이웨더 Air365  │   │ 기상청 API허브/ASOS │
   │ Postgres │   │ (KW_API_KEY)     │   │ (KMA_API_KEY)       │
   │ (kweather│   └──────────────────┘   └────────────────────┘
   │  스키마) │   ┌──────────────────┐
   └──────────┘   │ 카카오 로컬       │  ← 지오코딩/행정동코드
                  │ (KAKAO_REST_KEY) │     (없으면 Nominatim 폴백)
                  └──────────────────┘
```

**핵심 배선 사실**: 프런트(`web`)와 백엔드(`api`)는 **서로 다른 오리진**이며, 같은 오리진 `/api` 프록시가 아니다.
빌드 시 `VITE_API_BASE=https://kweather-dashboard-api.vercel.app`가 번들에 박혀 교차 출처 호출을 하고, 백엔드 CORS `*`가 이를 허용한다. (커밋된 `frontend/.env.example`의 `VITE_API_BASE=`는 비어 있음 → 실제 값은 Vercel 빌드 환경변수로 주입.)

### 1.2 소스 구조

```
backend/                         FastAPI (Python 3.12)
├─ api/index.py                  Vercel 서버리스 진입점 (app.main:app 로드)
├─ vercel.json                   region icn1, maxDuration 60s, /(.*)→/api/index
├─ requirements.txt              운영 의존성(250MB 한도용, matplotlib 제외)
├─ requirements-dev.txt          로컬용(matplotlib 포함)
├─ app/
│  ├─ main.py                    앱 조립 · CORS · 9개 라우터 등록 · /api/health · 정적서빙(로컬)
│  ├─ config.py                  pydantic-settings (env → 설정)
│  ├─ database.py                SQLAlchemy 엔진/세션 (SQLite ↔ Postgres)
│  ├─ models.py                  ORM 5개 테이블
│  ├─ schemas.py                 Pydantic I/O 스키마
│  ├─ deps.py / security.py      X-API-Key 테넌트 해석 · pbkdf2_sha256
│  ├─ access.py                  접근 로깅 미들웨어 → AccessLog
│  ├─ heat.py                    폭염 5단계 분류
│  ├─ routers/  (9)              auth·devices·upload·data·dashboard·geocode·weather·reports·admin
│  └─ services/ (5)              ingest·analytics·weather·geocode·report
└─ seed.py                       로컬 샘플 시드

frontend/                        React 18 + TS + Vite + Tailwind
├─ vercel.json                   framework vite, /(.*)→/index.html
├─ src/api.ts                    단일 API 클라이언트 (모든 fetch 집약)
├─ src/App.tsx                   4단계 스텝 오케스트레이터
└─ src/components/ (15)          AuthScreen·Stepper·DeviceRegister·DeviceManager·
                                 UploadPanel·KpiCards·TimeSeriesChart·WeatherCompareChart·
                                 HeatGuidelines·HeatBadge·ReportPanel·AdminPage·SiteFooter·Icons
```

### 1.3 데이터 모델 (PostgreSQL `kweather` 스키마)

```
Tenant (멀티테넌트 루트)                 Device (기기/사업장)
├ id (PK)                               ├ device_sn (PK)
├ api_key (unique)  ← X-API-Key 자격     ├ tenant_id (FK→Tenant)  ★격리키
├ email (unique)    ← 로그인 ID          ├ company_name/location_name/address
├ password_hash     ← pbkdf2_sha256      ├ latitude/longitude
└ created_at                            └ region_code (행정동 10자리)
        │1                                       │1
        │                                        │
        ▼N                                       ▼N
  (devices)                              SensorLog (시계열 원천)
                                         ├ id (PK)
ExternalDailyCache (외부날씨 캐시)        ├ device_sn (FK)
├ (device_sn, ymd) unique               ├ measured_at  ┐ UNIQUE(device_sn,
├ avg/max/min_temp, humidity            ├ temperature  ┘  measured_at) ★Upsert키
├ source, region                        ├ humidity
└ hourly_json (시간별 ta/hm/feels)       └ feels_like_temperature

AccessLog (감사/트래픽 — 관리자 집계용)
├ ts, ymd, method, path, status
├ kind (api|upload|report|visit)
├ tenant_id, visitor("t:{id}" 또는 "ip:{ip}")
└ rows (업로드 반영행 수)
```

멀티테넌트 격리: 모든 데이터 쿼리는 `X-API-Key → Tenant` 해석 후 `tenant_id`로 필터링한다 (`deps.get_tenant`). 타 사업장 SN 접근은 차단된다(PRD 6.3).

---

## 2. 현재 배포 현황 (라이브 실측)

### 2.1 라이브 헬스체크 — `GET /api/health` (2026-06-16 실측 응답)

```json
{
  "status": "ok",
  "database": "postgresql",
  "weather_provider": "kweather",
  "kweather_key_set": true,
  "kma_asos_key_set": true,
  "geocoder": "kakao",
  "thresholds": { "attention": 31.0, "caution": 33.0, "warning": 35.0, "danger": 38.0 }
}
```

| 항목 | 실배포 값 | 비고 |
| --- | --- | --- |
| 웹 (`/`) | **HTTP 200**, `<title>체감온도계 데이터 분석 프로그램</title>` | 정상 서빙 |
| 번들 API base | `https://kweather-dashboard-api.vercel.app` | 번들에 하드코딩 확인 |
| DB | **PostgreSQL (Supabase)** | README 기본값(SQLite)과 다름 |
| 날씨 공급자 | **kweather (Air365)** | README 스택표(mock/kma)에 없음 |
| KW/KMA/Kakao 키 | **3종 모두 set=true** | 외부 연동 완전 가동 상태 |
| 폭염 임계 | 31 / 33 / 35 / 38 ℃ | 기본값 그대로 |

### 2.2 두 Vercel 프로젝트 구성

- **kweather-dashboard-web** — `frontend/` 루트, `vite` 빌드, `dist/` 정적 서빙, SPA rewrite. 데이터/연산 없음(순수 정적).
- **kweather-dashboard-api** — `backend/` 루트, Python 서버리스, **서울 리전(icn1)**, 함수 **maxDuration 60초**, 모든 경로를 FastAPI로 rewrite.
- CI/CD: `main` push 시 두 프로젝트 자동 배포.

### 2.3 운영상 제약 (코드에 반영된 한도)

- 서버리스 **요청 본문 4.5MB / 실행 60s** 한도에 맞춘 방어 코드 다수:
  - 업로드: 프런트가 배치 분할(배치당 ≤3.5MB·≤20파일, 동시성 3) — `api.ts`
  - Excel 내보내기: 로우데이터 **10만 행 상한**(`EXPORT_RAW_MAX`), 초과 시 안내행 추가 — `report.py:747`
  - 리포트 504 타임아웃 시 "기간 축소" 안내 — `ReportPanel.tsx`
- 서버리스 읽기전용 FS 대응: `EXPORT_DIR.mkdir` 예외 무시, `MPLCONFIGDIR=/tmp/mpl`, startup DB 초기화 예외 격리.

---

## 3. 배선된 항목 (Wired — End-to-End 동작)

### 3.1 API 엔드포인트 ↔ 프런트 호출 매핑 (21개 중 20개 배선)

| # | 백엔드 엔드포인트 | 프런트 호출 (`api.*`) | 사용 컴포넌트 | 배선 |
| --- | --- | --- | --- | --- |
| 1 | `POST /api/auth/signup` | `signup` | AuthScreen | ✅ |
| 2 | `POST /api/auth/login` | `login` | AuthScreen | ✅ |
| 3 | `GET /api/auth/me` | `me` | App / AuthScreen | ✅ |
| 4 | `GET /api/devices` | `listDevices` | App | ✅ |
| 5 | `POST /api/devices` | `createDevice` | DeviceRegister | ✅ |
| 6 | `PUT /api/devices/{sn}` | `updateDevice` | DeviceManager | ✅ |
| 7 | `DELETE /api/devices/{sn}` | `deleteDevice` | DeviceManager | ✅ |
| 8 | `POST /api/upload` | `upload` | UploadPanel | ✅ |
| 9 | `DELETE /api/data` | `resetData` | UploadPanel | ✅ |
| 10 | `GET /api/dashboard/data-range` | `dataRange` | App | ✅ |
| 11 | `GET /api/dashboard/kpi` | `kpi` | App→KpiCards | ✅ |
| 12 | `GET /api/dashboard/timeseries` | `timeseries` | App→TimeSeriesChart | ✅ |
| 13 | `GET /api/geocode` | `geocode` | DeviceRegister | ✅ |
| 14 | `GET /api/weather/compare` | `weatherCompare` | App→WeatherCompareChart | ✅ |
| 15 | `GET /api/reports/daily` | `dailyReport` | ReportPanel | ✅ |
| 16 | `GET /api/reports/daily.pdf` | `dailyPdfUrl`+`download` | ReportPanel | ✅ |
| 17 | `GET /api/reports/periodic.pdf` | `periodicPdfUrl`+`download` | ReportPanel | ✅ |
| 18 | `GET /api/reports/export.xlsx` | `excelUrl`+`download` | ReportPanel | ✅ |
| 19 | `GET /api/admin/overview` | `adminOverview` | AdminPage | ✅ |
| 20 | `GET /api/health` | `health` (정의됨) | — (호출처 없음, 진단용) | ⚠️ |
| 21 | `GET /api/weather/current` | **없음** | **없음** | ❌ |

### 3.2 완전 배선된 기능 흐름

- **인증/온보딩**: 회원가입·로그인·데모키(`demo-key`)·세션 부팅(`me`)·로그아웃. 자격은 `X-API-Key`(=Tenant.api_key), 비밀번호 `pbkdf2_sha256`(JWT 없음).
- **4단계 스텝 플로우**(`App.tsx`): ②기기등록 → ③업로드 → ④대시보드. 업로드 성공 시 자동으로 ④로 이동. (스텝 ①"계정"은 장식 — 실제 인증은 `AuthScreen`이 별도 처리하며 메인 플로우에서 렌더되지 않음.)
- **데이터 수집(`ingest.py`)**: **케이웨더 단말기 TXT 전용**. 콤마 구분 `YYYY-MM-DD HH:MM, 체감, 온도, 습도`, 헤더 없음. **CSV/XLSX/탭 구분/타포맷은 차단**(80% 라인 정규식 미일치 시 거부). 인코딩 자동감지(UTF-8/CP949), 결측 선형보간, `(device_sn, measured_at)` Upsert(ON CONFLICT). TXT엔 SN이 없으므로 업로드 시 대상 기기를 지정(기기 1대면 자동 선택).
- **대시보드(`recharts`)**: KPI 카드(최고 체감/온도·현재 위험단계) · 멀티축 시계열(1/10/30분 다운샘플, 임계 기준선) · 외부날씨 비교 차트(내부 체감 vs 외부 기온/체감, **밀폐형 폭염 경고**) · 폭염 단계별 안전가이드(고용노동부 2026 기준).
- **외부 날씨 비교(`weather.compare`)**: 핵심 배선. KMA_API_KEY가 있고 단일 일자면 **기상청 시간자료(공식 체감온도 포함)를 최우선**으로 시간 매칭하고, 없으면 공급자(kweather/mock) 시간값으로 폴백. `ExternalDailyCache`로 캐시-어사이드. → 운영에선 kweather 공급자라도 compare 경로는 **KMA 시간자료를 우선 사용**한다.
- **리포트(`report.py`)**:
  - 일일 PDF — A4, 7개 섹션(개요·요약·단계별 노출분·시간별 변화·내외부 비교·종합분석·조치권고), 5번 섹션부터 2페이지 분리, 한글 폰트 번들(NanumGothic). **PIL(Pillow) 경량 차트 2종 임베드**(시간별 체감·내외부 비교).
  - 기간 PDF — 요약·단계 도달 일수·일자별 트렌드 표.
  - Excel — `write_only` 모드, 일자별요약(SQL 집계)+로우데이터(10만행 상한) 2시트.
- **지오코딩**: 카카오 로컬(주소→위경도+행정동코드, 한국 주소 정확) → 실패 시 Nominatim 폴백. 등록 시 `region_code` 영구 저장(이후 외부 의존 제거).
- **관리자 대시보드(`AdminPage`)**: `ADMIN_EMAILS`(기본 `cmlee@kweather.co.kr`) 이메일 게이팅. 오늘/누적 KPI · 14일 트래픽 추이 차트 · 테넌트별 통계 표 · 최근 접근 로그 30건. 데이터 원천은 `access_log_middleware` → `AccessLog`.

---

## 4. 배선되지 않은 항목 (Not Wired — 정의/문서는 있으나 미연결)

### 4.1 🔴 위경도 기반 위험도 지도 — **완전 미구현** (문서에만 존재)

- README 기술스택: "React 18 + … + **React-Leaflet**", 기능 3.2: "**위경도 기반 위험도 지도(단계별 색상 마커)**".
- **실제**: `frontend/package.json`·`package-lock.json`에 **leaflet / react-leaflet 의존성 자체가 없음** (차트 라이브러리는 `recharts`만 존재). 소스 전체에 `MapContainer`/`TileLayer`/`Marker`/`leaflet` 참조 **0건**.
- 위경도는 `DeviceRegister`에서 **텍스트 입력 필드로만** 수집·저장되고, 지도 시각화는 어디에도 렌더되지 않는다. 수집된 위경도의 실제 용도는 **외부 날씨 조회(행정동코드 변환)** 이지 지도 표시가 아니다.
- 판정: **기능 미착수**. 문서가 PRD 목표를 그대로 옮겼으나 구현이 따라오지 않은 항목.

### 4.2 🟠 현재 외부 날씨 `/api/weather/current` — **고아 엔드포인트** (백엔드 완성·배포, UI 미연결)

- 백엔드: `routers/weather.py` `GET /api/weather/current` + `services/weather.py` `current_external()`가 **완전 구현**됨 — 케이웨더 실황(`kw-odam1`: 기온/체감/습도) + 현장 최신값 비교 + 야외 폭염단계 + 밀폐 경고 + 안내 메시지까지 산출.
- 라이브 실측: `GET /api/weather/current?device_sn=…` → **HTTP 401**(인증 필요). 즉 **엔드포인트는 배포되어 살아 있다**. 운영 공급자가 `kweather`이므로 호출하면 실데이터를 반환할 수 있다.
- **프런트**: `api.ts`에 `weatherCurrent` 류 함수가 **없고**, 어떤 컴포넌트도 호출하지 않는다.
- 판정: **백엔드 100% 완성 + 배포됨, 프런트 배선 0%**. 함수 1줄 + 컴포넌트 추가면 노출 가능한 "숨은 기능".

### 4.3 🟡 `GET /api/health` — 클라이언트 함수만 존재, 호출처 없음

- `api.health()`가 `api.ts`에 정의돼 있으나 어떤 컴포넌트도 호출하지 않는다. 진단/수동용으로만 유효. (운영엔 무해.)

---

## 5. 문서 ↔ 현실 불일치 (Documentation Drift)

배선과 별개로, **문서가 실배포를 따라오지 못한** 항목들. 운영자 혼란을 유발하므로 별도 분리.

| # | 문서 진술 | 실제(코드/라이브) | 영향 |
| --- | --- | --- | --- |
| D1 | README 스택표: 외부날씨 `mock(기본)/kma` | 운영 공급자 = **`kweather`** (Air365), 코드 `config.py`엔 3번째 공급자 정식 구현 | 스택표가 실제보다 축소 기술 |
| D2 | README: "기본 구동은 **SQLite**" | 운영 DB = **PostgreSQL/Supabase** | 로컬·운영 차이는 의도된 것이나 표기 혼동 |
| D3 | README: "PDF의 **차트 이미지(matplotlib)는 배포본에서 생략**" | **일일 PDF는 PIL 차트 2종을 운영에서도 임베드**(Pillow가 `requirements.txt`에 포함). matplotlib 생략은 **기간 PDF 차트에만** 해당 | 일일 PDF 차트는 실제로 나옴 → 진술이 부분적으로 구식 |
| D4 | `backend/.env.example`: `WEATHER_PROVIDER=mock # mock \| kma` | 실제 `config.py`는 `kweather`/`KW_API_KEY`/`KW_BASE_URL`/`KAKAO_REST_KEY`/`ADMIN_EMAILS`를 지원하나 **템플릿엔 미기재** | 신규 배포자가 키 주입 항목을 알 수 없음 |
| D5 | README: "psycopg2-binary **주석 해제 후 재설치**" | `requirements.txt`에서 이미 **주석 해제됨**(=2.9.10 활성) | 사소한 구식 안내 |
| D6 | `frontend/.env.example`: `VITE_API_BASE=`(빈값) | 실제 번들엔 `…-api.vercel.app`가 주입(Vercel 빌드 env) | 동일 오리진 오해 소지 |

---

## 6. 데드코드 / 미사용 정의 (Defined but Unreferenced)

소스를 호출 그래프로 추적해 확인한 **정의됐으나 호출되지 않는** 항목.

### 백엔드
- **`report.py:_daily_chart()` (84–106행, matplotlib 기반 일일 차트)** — **데드코드**. `daily_pdf()`는 이를 호출하지 않고 PIL 기반 `_chart_hourly_feels()`/`_chart_compare()`(659–660행)를 사용한다. matplotlib 시절의 잔재.
- **`weather.py:_kma_asos_hourly()` (235–239행, 행정동코드 진입 래퍼)** — **데드코드**. 실제 경로는 `kma_hourly_cached()` → `_kma_asos_hourly_stn()`(관측소번호 기반, 221행)로 일원화됐고 코드 기반 래퍼는 호출되지 않는다.

### 프런트
- **`Icons.tsx`의 `IconRefresh`/`IconShield`/`IconInfo`** — export만 되고 어디서도 import되지 않음.
- **`Stepper`의 스텝 ①"계정"** — 데이터 모델상 존재하나 메인 플로우에서 도달 불가(인증은 `AuthScreen`이 별도 처리). UI상 비활성 단계.

> 그 외 백엔드 `_`-프리픽스 헬퍼들(`_detect_encoding`, `_upsert_logs`, `_resolve_scope`, `_kind_for` 등)과 `KmaWeatherProvider`/`MockWeatherProvider`는 모두 호출처가 존재한다(공급자 교체용으로 의도된 대체 구현).

---

## 7. 종합 배선 매트릭스

| 영역 | 백엔드 | 프런트 | 배포 | 판정 |
| --- | :--: | :--: | :--: | --- |
| 인증/테넌트 | ✅ | ✅ | ✅ | 완전 배선 |
| 기기 CRUD | ✅ | ✅ | ✅ | 완전 배선 |
| 업로드(TXT)/초기화 | ✅ | ✅ | ✅ | 완전 배선 |
| KPI·시계열 대시보드 | ✅ | ✅ | ✅ | 완전 배선 |
| 외부날씨 **비교**(compare) | ✅ | ✅ | ✅ | 완전 배선 (KMA 우선+kweather 폴백) |
| 폭염 안전가이드 | ✅ | ✅ | ✅ | 완전 배선 |
| 리포트 일일 PDF(+PIL차트) | ✅ | ✅ | ✅ | 완전 배선 |
| 리포트 기간 PDF | ✅ | ✅ | ⚠️ | 배선됨, 단 차트는 운영서 생략(matplotlib無) |
| 리포트 Excel | ✅ | ✅ | ✅ | 완전 배선 (10만행 상한) |
| 지오코딩 | ✅ | ✅ | ✅ | 완전 배선 (카카오→Nominatim) |
| 관리자 대시보드 | ✅ | ✅ | ✅ | 완전 배선 (이메일 게이팅) |
| 외부날씨 **현재값**(current) | ✅ | ❌ | ✅(배포·401) | **백엔드만 — UI 미배선(고아)** |
| **위험도 지도(Leaflet)** | — | ❌ | ❌ | **미구현 (문서에만 존재)** |
| `/api/health` 클라이언트 | ✅ | ⚠️정의만 | ✅ | 호출처 없음(진단용) |

---

## 8. 권고 (우선순위순)

1. **문서 정합화(즉시·저비용)**: README 스택표에 `kweather` 공급자·PostgreSQL 운영을 명시하고, "matplotlib 차트 생략"을 "기간 PDF 차트에 한함, 일일 PDF는 PIL 차트 포함"으로 정정(D1·D2·D3·D5). `backend/.env.example`에 `WEATHER_PROVIDER=kweather`, `KW_API_KEY`, `KW_BASE_URL`, `KAKAO_REST_KEY`, `ADMIN_EMAILS`, `DATABASE_URL`(Supabase 형식) 항목 추가(D4). `frontend/.env.example`에 운영 `VITE_API_BASE` 예시 명시(D6).
2. **고아 기능 결정(중)**: `/api/weather/current`를 (a) 대시보드에 "현재 외부 날씨" 위젯으로 **배선**하거나, (b) 미사용이면 라우터에서 제거. 현재는 완성된 백엔드가 노출되지 않은 채 방치.
3. **지도 기능 의사결정(중)**: README의 "위험도 지도"를 (a) react-leaflet 도입해 실제 구현하거나, (b) PRD 미충족 항목으로 README에서 내려 문서-현실을 일치.
4. **데드코드 제거(저)**: `report._daily_chart`, `weather._kma_asos_hourly`, 미사용 아이콘 3종 정리(유지보수 혼선 제거).
5. **운영 견고화(검토)**: CORS `allow_origins=["*"]`를 운영 도메인으로 제한(코드 주석도 "운영 시 도메인 제한 권장"으로 인지). 데모키(`demo-key`) 공개 노출 범위 점검.

---

### 부록 A — 폭염 위험 5단계 (`heat.py`, 체감온도 A-TEMP 기준)

| 단계 | code | 임계 | 색상 | rank |
| --- | --- | --- | --- | --- |
| 안전 | safe | < 31℃ | 초록 #16a34a | 0 |
| 관심 | attention | ≥ 31℃ | 연두 #84cc16 | 1 |
| 주의 | caution | ≥ 33℃ | 노랑 #facc15 | 2 |
| 경고 | warning | ≥ 35℃ | 주황 #f97316 | 3 |
| 위험 | danger | ≥ 38℃ | 빨강 #dc2626 | 4 |

### 부록 B — 분석 산출 근거(실측 명령)

- 라우트 열거: `grep '@router.(get|post|put|delete)' backend/app/routers/`
- 프런트 호출 열거: `grep -o 'api\.[a-zA-Z]+' frontend/src` (21개 호출, `weatherCurrent` 부재 확인)
- 의존성: `package.json`/`package-lock.json` — leaflet 부재, recharts만 존재
- 라이브: `curl …/api/health`(kweather/postgresql/키3종 set), 웹 HTTP 200, 번들 내 API base 추출, `…/api/weather/current` → 401(배포 확인)
- 데드코드: `_daily_chart`/`_kma_asos_hourly` 호출처 0건 확인

*— 본 문서는 2026-06-16 기준 리포지터리 정적분석 + 라이브 환경 실측을 종합한 분석 정본이다.*
