# 케이웨더 안전보건 대시보드 — 작업 정본 (Session Master Record)

> 기준일: 2026-06-16 · 리포지터리: `wellbianlabs/kweather-dashboard`
> 범위: 이번 세션에서 수행한 **분석 → Mantine 전환/업그레이드 → 디자인 개편 산출물 → 컴포넌트 카탈로그 → Mantine UI 이식 → 프론트 리뉴얼 → 차트 개선 → 위험지도 스켈레톤** 전체.
> 작업 브랜치: `feature/mantine-migration` (프로덕션 `/` 무변경, origin 미푸시)
> **⚡ 2026-06-17 갱신 — 아래 「현행 정본」이 최신. 이하 §0~§7은 06-16 베이스라인 기록(이력 보존).**

---

## ⚡ 현행 정본 (2026-06-17)

> 06-16 이후 본 세션에서 진행한 전부. 브랜치 **`Dev`**(=feature/mantine-migration, origin/Dev push) · 최근 변경은 **로컬 보유**(서버 재배포 전).

### 현재 상태
| 항목 | 상태 |
| --- | --- |
| 스택 | React 19 + Mantine 9.3.1 + recharts 3 + **react-router 7** + Vite 5 / 백엔드 FastAPI + Jinja2 + xhtml2pdf + PIL |
| 빌드/검증 | ✅ `tsc -b` 0 · 런타임 콘솔 0 (renew 실앱·리포트·관리자·설정 검증) |
| 진입점 | **`/` = RenewRoot(실앱)** 승격 — react-router + 인증게이트 + 실데이터. (구 catalog/mockup/report-studio 등 dev 엔트리 유지) |
| 운영 배포 | **자체호스팅 `https://sts.kweather.co.kr`** 라이브(Ubuntu20.04·PG12·nginx+LE) — `서버구축정본` 참조. **현재 점검상 로그인 차단**(`/api/auth/*` 503). 로컬 최신 변경은 미반영. |
| 데이터 | DB=PostgreSQL(서버)/SQLite(로컬). 날씨=mock(실키 대기). 데모 시드 06-09~16. |

### 본 세션 주요 워크스트림
1. **Tailwind 완전 제거·Mantine 단일화**(Phase 4) + **renew 실 진입점 승격**(라우팅·인증·실데이터) + **kw-dash 클래스 네임스페이스** + 로그인 "Authentication image" 이식.
2. **폭염 보고서(일일/기간) 리디자인 → 백엔드 반영**: `report.py` `_DAILY_/_PERIODIC_TEMPLATE` Jinja2 전면 교체(미니멀 헤더+식별번호·심리스 테이블·타임라인 밴드+2열 범례·페이지번호 `@frame`), PIL 차트 recharts 룩(`_chart_timeline_band`·`_pil_periodic_bars`). **함정**: xhtml2pdf 페이지번호=`left/width`+`pt`必, NanumGothic `℃`/`▾` 글리프 부재→`°C`/`▼`, `<img>` width `%`불가→pt. → `kw-dashboard-report-redesign` 메모리.
3. **자체호스팅 배포**(Vercel 탈피) — `서버구축정본`. 함정: deadsnakes PPA 차단→python-build-standalone, openrsync 깨짐→tar+scp.
4. **대시보드 리뉴얼**(협업팀 목업 정합): `renew/pages/DashboardPage.tsx` = KPI 3종 + 좌(일일 리포트 요약·데이터 분석[TimeSeriesChart]) + 우(최근 7일 일최고체감[실측]·폭염 관심 지수 4단계 게이지). 위험지도·외부비교·사업장표 제외.
5. **nav/셸 완전 리팩토링**: 데스크톱 AppShell **header 제거**(상단 낭비)·테마토글 nav 하단 이전·**Mantine "Simple navbar" 정합**(NavLink, active=light kw)·**측정기 목록 상단 / 리포트·기기관리·관리자 하단**(상하 구역 분리, 위험지도·설정 메뉴 제거). inner 최대폭 1200.
6. **공통 업로더**: `components/UploadModal.tsx`(드롭존·프로그레스·결과·기기 사전선택) 전역 1개 — nav 측정기 [+] · **대시보드 ContextBar [업로드] 병합**. 기기 관리 페이지 업로더 제거. provider `openUpload/lastUpload`.
7. **ContextBar 개선**: 아이콘 셀렉트·시간간격 SegmentedControl·라벨 정렬. 대시보드=측정기/업로드/분석일자/시간간격/[기간보고서]. **리포트=측정기→분석일자→보고서유형→[보고서 생성] submit 흐름**(`ReportPage.tsx` 단일 통합).
8. **관리자 접속기록 통합**(AdminPage: 트래픽+접근로그+적재 한 화면) · **회원정보 수정**(`PATCH /api/auth/me`+`ProfileUpdateIn`·`api.updateProfile`·SettingsPage 폼).
9. **실데이터 배선**: 주간 위젯=최근 7일 per-day `kpi`(예보 API 부재 — provider는 current/past만), 게이지=최근 측정 체감. 푸터 간이화, 브랜딩 문구 **"체감온도 데이터 분석 프로그램"**.

### 남은 작업
- 🚧 **리포트 디자인 정합(미완 — 후임 재개 1순위)**: 웹 `WebReport`(ReportPanel.tsx, **5섹션**) vs PDF-전 HTML(`catalog/dailyReportHtml.ts`)·백엔드 PDF(`report.py`)(**8섹션**) 불일치. 사용자 결정 **풀 8섹션 통일** → 웹 WebReport를 8섹션으로 확장. **데이터는 백엔드 `_daily_detail`에 이미 있음**(external_daily·analysis·weather·hours.out_feels) → `schemas.py DailyReportData` + `types.ts DailyReport` 필드 추가 + WebReport 재작성(기준=dailyReportHtml.ts). 기간 보고서도 동일 점검. **상세 = `README.md` 핸드오프 §리포트 디자인 정합**.
- **서버 재배포**: 위 로컬 변경(프론트 빌드+백엔드)을 sts 서버에 반영 + 로그인 차단(`/api/auth/*` 503) 해제 시점 결정.
- 주간 **예보 실데이터**(forecast API/provider 메서드 신설 필요) · 일일 24h curve 튜닝 · 회원정보 수정 외 관리자 확장(권한/회원관리).

---

## 0. 현재 상태 한눈에 *(06-16 베이스라인)*

| 항목 | 상태 |
| --- | --- |
| 스택 | **React 19.2.7 + Mantine 9.3.1 + recharts 3.8.1 + Vite 5** (기존 React18/Mantine8/recharts2에서 업그레이드) |
| 빌드 | ✅ `tsc -b` 0 에러 · `vite build` 성공 (JS 308KB gz) |
| 런타임 | ✅ 4개 화면 전부 콘솔 에러 0 (라이브 백엔드 검증 포함) |
| Git | 브랜치 `feature/mantine-migration` · 커밋 1개(Mantine 마이그레이션) · **이후 작업 미커밋(변경 4 / 신규 19)** |
| 배포 | **프로덕션 무변경**(origin 미푸시) — 사용자 결정: 푸시 보류·PR 방식 |
| 로컬 서버 | 웹 :9999(0.0.0.0) · API :4343(0.0.0.0, Python3.12 venv·SQLite·시드 데이터) |

### 로컬 진입점 (HMR 동기)
| URL | 용도 |
| --- | --- |
| `http://localhost:9999/` | **실 프로덕션 앱**(현행 코드 + 차트 기간배선 반영) |
| `http://localhost:9999/renew.html` | **프론트 리뉴얼**(이식 5종 + AppShell + 스켈레톤 지도 통합) |
| `http://localhost:9999/catalog.html` | **컴포넌트 카탈로그**(디자인 커스텀 워크플로우) |
| `http://localhost:9999/mockup.html` | 대시보드 레이아웃 목업 |
| (네트워크) | `http://192.168.0.9:9999/...` 동일 |

---

## 1. 의사결정 로그

| # | 결정 | 근거/메모 |
| --- | --- | --- |
| D-1 | **코드 분석 정본 생성** | README/PRD vs 실제 배선 교차분석 → `분석정본_…md` |
| D-2 | **UI 라이브러리 = Mantine 확정** | shadcn과 교차비교 후 사용자 확정 (배터리 포함·해당 앱 위젯 1:1) |
| D-3 | **버전 = React 19 + Mantine 9.3.1 + recharts 3** | 격리 스파이크로 **코드 변경 0줄·빌드/런타임 클린** 검증 후 적용 |
| D-4 | **디자인 개편 방향** | 풀 리디자인+신기능 · 완전 반응형 · **적극 리브랜딩** · 다크모드+위험지도+현재날씨 포함 |
| D-5 | **푸시 보류 · PR 방식** | 프로덕션 자동배포 회피, 검토 후 머지(사용자 직접) |
| D-6 | **차트 = 리포트 기간(N일) 조회 배선** | 시계열만 기간 / 외부비교는 기준일자 유지(외부 시간자료가 단일일 기준) |
| D-7 | **위험지도 = 스켈레톤 v1(무의존)** | 폭염 단계 기반 경량 지도 먼저, 정식 Leaflet은 후속(D3) |
| D-8 | **불변 제약** | 폭염 5단계색(연두·노랑·주황·빨강)·임계(31/33/35/38℃) = 정부 표준 → 리브랜딩 대상 아님 |

---

## 2. 작업 내역 (단계별)

### A. 코드 분석 — `분석정본_KW-DASHBOARD.md`
- 구조도·배포현황(라이브 health 실측: PostgreSQL/Supabase·weather=kweather·키3종 set)·배선/미배선 종합.
- 핵심 발견: **위험지도(React-Leaflet) 완전 미구현**(문서에만 존재), `/api/weather/current` **고아 엔드포인트**(백엔드 완성·UI 미배선), README 스택표·`.env.example` 구식, 데드코드 2건.

### B. Mantine 전환 (Phase 0–3) + 버전 업그레이드 — **커밋됨** + 이후 미커밋
- **Phase 0**: `theme.ts`(kw 네이비/sky 10단계·Pretendard·shadow·radius), `MantineProvider`+`DatesProvider(ko)`+`Modals`+`Notifications`, **Tailwind↔Mantine CSS 캐스케이드 레이어 공존**(tailwind-base < mantine < tailwind-utilities).
- **Phase 1**: AuthScreen.
- **Phase 2**: UploadPanel(Dropzone)·Stepper·DatePickerInput·notifications·modals.
- **Phase 3**: KpiCards·HeatBadge·HeatGuidelines·차트2종·ReportPanel·DeviceRegister/Manager·AdminPage·SiteFooter·App 버튼/박스 → 전부 Mantine. `Icons.tsx` 제거(→@tabler).
- **업그레이드**: React19·Mantine9.3.1·recharts3 (v9 변경점: `Grid` `gutter`→`gap` 등 반영).

### C. 디자인 개편 산출물
- `디자인개편_기획서_KW-DASHBOARD.md`: 문제정의·페르소나·원칙5·**리브랜딩 3안(A Signal 추천)**·디자인시스템·IA개편(상시 네비)·핵심화면·반응형/A11y·신기능·**로드맵 D0–D4**.
- `레이아웃설계_KW-DASHBOARD.md`: 12-col 그리드·AppShell 해부도·브레이크포인트(≥md 사이드바↔하단탭)·화면별 데스크톱/모바일 와이어·Mantine 매핑.

### D. 컴포넌트 카탈로그 + 워크플로우 — `catalog.html`
- `src/catalog/{CatalogApp,stories}.tsx`: 실제 컴포넌트 직접 import(단일 진실원본) → **HMR 즉시 동기화**.
- 작업자 라이브 커스텀: **브랜드 프리셋(kw/Signal/ClearSky/ControlRoom)·라운드·다크** + 컴포넌트 노브 → **"지시문 복사"** → 에이전트 반영 루프.
- 문서: `컴포넌트카탈로그_워크플로우.md`.

### E. Mantine UI 이식 (ui.mantine.dev · MIT) — `src/components/ui/`
- 교차비교 후 성격 부합 5종 **디자인 그대로 이식**(브랜드 kw·한국어):
  `AppNavbar`(Navbar simple)·`StatsGrid`(Stats grid)·`AccountButton`(User button)·`DataTable`(Table scroll area·sticky)·`SiteFooterLinks`(Footer links). CSS 모듈(`light-dark()`·`@mixin hover`) 그대로 동작.

### F. 프론트 리뉴얼 — `renew.html` (`src/renew/RenewApp.tsx`)
- AppShell + 이식 5종 + RiskHero/현재날씨 + 차트 + **스켈레톤 위험지도** 통합. 데스크톱/모바일/다크 검증.

### G. 차트 개선 — `src/components/{TimeSeriesChart,WeatherCompareChart,chartkit}.tsx`
- **N일 일자 라벨**: 데이터 기간 자동 감지 → X축 `시:분 ↔ M/D` 전환, 헤더 `측정일↔측정기간`.
- **날짜별 기준선**: 각 날짜 시작점에 점선+M/D 라벨(다일만).
- **최신 그래픽**: 그라데이션 영역·매끈한 라인·activeDot·가로그리드·축 정리·**Mantine 커스텀 툴팁**.
- **기간 배선(App.tsx)**: 시계열 = `리포트 기간(rangeStart~rangeEnd)` 조회 → 실앱에서 8일 실데이터 렌더 검증.

### H. 위험지도 스켈레톤 — `src/components/RiskMapSkeleton.tsx`
- **의존성 0**(Leaflet 미설치). 위경도→바운딩박스 투영 + **폭염 단계로 마커 색·크기·글로우**. hover 툴팁·범례·단계집계·좌표미입력 안내. 카탈로그/리뉴얼에 통합(placeholder 대체).
- 정식 Leaflet 지도는 후속(로드맵 D3)에서 교체.

---

## 3. 산출물 인벤토리

### 문서 (리포 루트, 미커밋)
```
분석정본_KW-DASHBOARD.md            코드/배포 분석 정본
디자인개편_기획서_KW-DASHBOARD.md    디자인 개편 기획
레이아웃설계_KW-DASHBOARD.md         레이아웃 실행 스펙
컴포넌트카탈로그_워크플로우.md         카탈로그 사용 워크플로우
작업정본_KW-DASHBOARD.md            ← 본 문서(세션 정본)
```

### 코드 (frontend/src)
```
theme.ts                      브랜드 테마
index.css / main.tsx          레이어 공존 + 프로바이더
components/                   (전부 Mantine 전환) + chartkit.tsx, RiskMapSkeleton.tsx
components/ui/                Mantine UI 이식 5종 (.tsx + .module.css)
catalog/ + catalog.html       컴포넌트 카탈로그
mockup/ + mockup.html         레이아웃 목업 + 목 데이터
renew/ + renew.html           프론트 리뉴얼
App.tsx                       시계열=리포트 기간 배선
```
- dev 전용 엔트리(mockup/catalog/renew)는 **프로덕션 빌드(index.html)에 미포함**.

### 스크린샷
- `design_screenshots/` (23개): authscreen·p2·p3·layout·catalog·cat_ui·chart·app_period·map 등.

---

## 4. Git 상태 & 커밋 가이드
- 브랜치 `feature/mantine-migration`, 마지막 커밋 `6d899ac`(Phase1–3 마이그레이션).
- **이후 작업(업그레이드·카탈로그·이식·리뉴얼·차트·지도·문서) 전부 미커밋.**
- 커밋 권고(분리):
  1. `build: React19 + Mantine9.3.1 + recharts3 업그레이드`
  2. `feat(ui): Mantine UI 이식 5종 (ui/)`
  3. `feat: 컴포넌트 카탈로그 + 레이아웃 목업 + 프론트 리뉴얼 (dev 엔트리)`
  4. `feat(chart): N일 일자라벨·날짜 기준선·기간 배선·디자인 갱신`
  5. `feat: 위험지도 스켈레톤(v1)`
  6. `docs: 분석/기획/레이아웃/카탈로그/작업 정본`
- `vite.config.ts`의 로컬 프록시 포트(4343)는 세션용 — 메인 반영 시 제외/원복 결정 필요.

---

## 5. 검증 상태
- ✅ `tsc -b` 0 에러 · `vite build` 성공(308KB gz)
- ✅ 런타임 콘솔 에러 0 — 앱/리뉴얼/카탈로그/목업 + 차트 N일/기간(라이브 백엔드)
- ✅ 다크모드·반응형(사이드바↔하단탭) 렌더 확인
- ⚠️ 다크모드 레거시 하드코딩색(측정일 strip·일부 제목) = D1 토큰화 대상

---

## 6. 남은 로드맵
- **본배선(실앱 승격)**: 라우팅(react-router) 도입 → `renew`를 실 진입점으로, 실데이터·인증 연결.
- **D1**: 리브랜딩 컨셉 택1 → `theme.ts v2`(라이트/다크 토큰)·ChartTheme.
- **D3 위험지도 정식화**: 스켈레톤 v1 → react-leaflet v2(타일·클러스터·팝업). 실데이터 = 기기 lat/lon + 기기별 현재 단계(엔드포인트 1개 추가 권장).
- **현재 외부날씨 위젯 배선**: `/api/weather/current`(배포 완료) → 대시보드 위젯 연결(저비용).
- **D4**: 반응형/A11y 마감 + **Tailwind 완전 제거**(컴포넌트는 이미 Mantine화) + 비주얼 회귀.
- **푸시/PR**: 검토 후 origin 푸시 → PR(머지=사용자).

## 7. 미해결 결정 항목
1. 리브랜딩 컨셉 택1 (A Signal / B Clear Sky / C Control Room)
2. 라우팅(react-router) 도입 승인
3. 위험지도: 스켈레톤 유지 기간 / Leaflet 전환 시점
4. 외부비교 차트도 기간 조회로 돌릴지(외부값 sparse 가능)
5. 문서·dev엔트리 커밋 포함 범위 / vite proxy 포트
6. 콘텐츠 최대폭(1280 vs 1440)·하단탭 4 vs 5

*— 본 문서는 2026-06-16 세션의 모든 산출물·결정·상태를 통합한 작업 정본이다. 후속 세션은 §6 로드맵·§7 결정항목에서 이어간다.*
