# 세션 앵커 (Resume Checkpoint) — KW-DASHBOARD

> 작성: 2026-06-17 · 컨텍스트 압축 대비 재개점. **여기부터 이어서 작업.**
> 브랜치 `Dev` (= feature/mantine-migration, **origin/Dev 추적** · main 미푸시 = 프로덕션 무변경)

## 0. 06-17 세션 추가 완료 (이 배너 우선 확인)
- **GitHub `Dev` 브랜치 생성·push**(origin/Dev). gh CLI(`wellbianlabs`) 인증 구성됨.
- **Tailwind 완전 제거·Mantine 단일화(Phase 4)** — 커밋 `7afa002`. ReportPanel 17섹션 재변환 · App.tsx 구조 · index.css/postcss/config/deps 정리. (상세 `재변환매칭정본` ✅완료)
- **#5 리뉴얼 실 진입점 승격** — react-router + 인증 게이트 + 실데이터 배선. `index.html`→`RenewRoot`. 라우트 `/`·`/map`·`/report`·`/devices`·`/settings`·`/admin`. 컨텍스트바·다크모드·모바일탭. 실렌더 검증 콘솔에러 0(`design_screenshots/renew_*.png`).
  - 신규: `src/renew/{DashboardProvider,RenewRoot}.tsx` + `src/renew/pages/{Dashboard,Map,Report,Devices,Settings}Page.tsx`. ui/ NavbarNested·LinksGroup·AccountButton 라우터-인지화.
  - **미푸시 결정**: 사용자 "로컬만 유지" · **리브랜딩(#6) 보류**(theme v2/다크 컨셉 나중).
- **로그인 화면 Mantine "Authentication with image" 이식**(커밋 `6211fb1`) — 2단(폼+커버) 반응형, 인증로직 보존. 배경이미지 비테마(안개 건물) → 교체 후보.
- **클래스 네임스페이스 kw-dash 재정립**(커밋 `fea144d`) — `classNamesPrefix="kw-dash"`×5 + Vite css.modules. mantine-* 잔존 2(전역 focus/active)만.
- **#5 후속 완료**(커밋 `a05e2a7`): DataTable·RiskMap **실데이터 배선**(per-device kpi `sites` 레이어+`siteAdapters`) · **다크모드 수정**(index.css body light-dark — 하드코딩 #1e293b가 다크 텍스트 묻히던 핵심버그) · **고아 4종 삭제**(App.tsx·renew.*) · **백엔드 SPA fallback**(`SPAStaticFiles`, /api 가드).
  - **남은 폴리시**: DataTable/RiskMap 정렬·`현재 외부 날씨` 위젯 정식 엔드포인트(`/api/weather/current` 고아) · Leaflet 정식지도(현 스켈레톤) · 로그인 배경이미지 교체 · #6 리브랜딩 · origin push.
- **폭염 보고서 리디자인 — 백엔드 PDF 반영 완료**(메모리 `kw-dashboard-report-redesign`): `backend/app/services/report.py` `_DAILY_TEMPLATE`·`_PERIODIC_TEMPLATE` Jinja2 전면 교체(프론트 디자인 미러: 미니멀 헤더+식별번호·심리스 테이블·히어로·타임라인 밴드+2열 범례). PIL 차트 `_chart_timeline_band`·`_pil_periodic_bars`(recharts 룩). 검증 일일 3p·기간 2p.
  - **xhtml2pdf 함정 4종(재현 주의)**: ①페이지번호 `@frame`은 `left/width`+`pt` 必(`right`/`px` 실패) ②강제 `<pdf:nextpage/>` 빈페이지 유발→블록 `keeptogether`로 ③PIL폰트(NanumGothic) `℃`·`▾` 글리프 없음→`°C`/`▼` ④차트 `<img>` width `%` 불가→`540pt` 고정. matplotlib는 Vercel 250MB 초과→PIL이 프로덕션.
  - **리포트 남은 대기열**: A4 프론트 `WebPeriodicReport`→실 `/report` 배선 · B1 리포트에 6계열 데이터분석 차트 넣을지 확인 · B2 PDF 1–2p 고정섹션(인터럽트) · B3 기상청 습도 프로덕션 캐시.
- **자체호스팅 배포 완료 → https://sts.kweather.co.kr 라이브**(메모리 `kw-dashboard-server-deploy`): Vercel 탈피, Ubuntu 20.04 서버(`ssh kweather-sts`)에 단일오리진(nginx+LE TLS → uvicorn systemd `kweather` 4workers → FastAPI API+SPA → PostgreSQL12). `/opt/kweather`{backend(.venv=/opt/python311 PBS Py3.11),frontend/dist}. PDF 차트=PIL(no mpl) 검증.
  - **현재 mock+데모시드**. 날씨 실데이터=`.env` `WEATHER_PROVIDER`/`KW_API_KEY` 채우고 `sudo systemctl restart kweather`(사용자 ENV 수립 예정).
  - **업데이트 절차**: 로컬 `npm run build`→dist는 **tar+scp**(openrsync 깨짐), backend는 rsync, `systemctl restart kweather`. 함정: deadsnakes PPA 차단→python-build-standalone 사용.
  - **⚠️ 운영 점검상 로그인 차단 중**: nginx `location ^~ /api/auth/` → 503(로그인/가입/데모 진입 불가, 로그인 화면만 노출). 해제=해당 블록 제거+reload(`.bak` 백업 있음).
- **대시보드·IA 리뉴얼 + nav/ContextBar 완전 리팩토링(06-17 후반, 로컬)** (메모리 `kw-dashboard-report-redesign` 연계):
  - **대시보드**(`renew/pages/DashboardPage.tsx`): 협업팀 목업 정합 → KPI 3종 + 좌(일일 리포트 요약·데이터 분석[TimeSeriesChart]) + 우(최근 7일 일최고체감[실측 per-day kpi]·폭염 관심 지수 4단계 게이지). 위험지도/외부비교/사업장표 제외.
  - **nav/셸**: 데스크톱 AppShell **header 제거**·테마토글 nav 하단 이전·Mantine **"Simple navbar" 정합**(NavLink active=light kw)·**측정기 목록 상단 / 리포트·기기관리·관리자 하단**(상하 분리)·위험지도·설정 메뉴 제거·inner 1200·푸터 간이화·브랜딩 "체감온도 데이터 분석 프로그램".
  - **공통 업로더**(`components/UploadModal.tsx`): nav 측정기 [+] · 대시보드 **ContextBar [업로드] 병합**. 기기관리 페이지 업로더 제거. provider `openUpload/lastUpload/weekly` 추가.
  - **ContextBar**: 아이콘 셀렉트·시간간격 SegmentedControl·라벨 정렬. **리포트=측정기→분석일자→보고서유형→[보고서 생성] submit**(`ReportPage.tsx` 단일 통합) · **관리자 접속기록 통합**(AdminPage) · **회원정보 수정**(`PATCH /api/auth/me`+`ProfileUpdateIn`·`api.updateProfile`·SettingsPage).
  - **검증**: `tsc -b` 0 · 콘솔 0. **로컬 변경 미배포**(서버 재배포 시 일괄 반영 예정).
  - 정본 문서는 **`Doc/`** 폴더로 이동(2026-06-17).

## 1. 현재 상태
- **스택**: React 19.2.7 + Mantine 9.3.1 + recharts 3.8.1 + Vite 5 + d3-geo + react-pdf 10.4.1
- **빌드**: `tsc -b` 0 · `vite build` 성공 (메인 317KB gz / PdfViewer·worker는 on-demand)
- **로컬 서버(가동중)**: 웹 `http://localhost:9999/` · API `http://127.0.0.1:4343/`(0.0.0.0, Python3.12 venv·SQLite·시드데이터) · LAN `192.168.0.9`
- **dev 엔트리 4종**: `/`(실앱) · `/renew.html`(리뉴얼) · `/catalog.html`(카탈로그) · `/mockup.html`(목업)
- **미커밋**: `vite.config.ts`(로컬 프록시 4343, 세션용 — 메인 반영 시 제외/원복 결정) · `design_screenshots/`(스크린샷, 커밋 제외) · `.DS_Store`

## 2. 이번 세션 커밋 (분기점 `61db5d4` 이후)
```
e3dd044 멀티디바이스 PDF 뷰어(react-pdf) — ReportPanel iframe 교체
fcdcdd6 docs: 재변환 매칭 정본
1f3766b 리뉴얼 KPI 동기화(실 KpiCards 4종)
ea817de Merge origin/main  ← 원작자 13커밋 통합
33b400c docs: 정본 6종
40e151d post-migration(카탈로그·리뉴얼·이식·차트·지도)
6d899ac Mantine 9 마이그레이션(React19/recharts3)
```

## 3. 작업 진척 (완료)
- ✅ **코드/배포 분석** → `분석정본`. **Mantine 확정**(vs shadcn). **React19+Mantine9+recharts3 업그레이드**(스파이크 검증).
- ✅ **Mantine 전환 Phase 0–3** 전 컴포넌트(Icons→tabler). **차트**: N일 일자라벨·날짜 기준선·리포트 기간 배선·chartkit(커스텀 툴팁).
- ✅ **디자인 개편 산출물**: `디자인개편_기획서`(리브랜딩 3안·로드맵 D0–D4)·`레이아웃설계`(AppShell·반응형).
- ✅ **컴포넌트 카탈로그**(`catalog.html`) + 워크플로우(테마 프리셋·노브·지시문 복사, HMR 동기화).
- ✅ **Mantine UI 이식 7종**(`ui/`): AppNavbar·**NavbarNested(리뉴얼 사이드바 적용)**·StatsGrid·AccountButton·DataTable·SiteFooterLinks·NavbarLinksGroup.
- ✅ **프론트 리뉴얼**(`renew.html`, AppShell+이식+RiskHero+차트+스켈레톤지도).
- ✅ **위험지도 스켈레톤 v1.5**: 시도 GeoJSON(`public/korea-provinces.geo.json`)+d3-geo, **무지도API**. 폭염 단계 마커.
- ✅ **멀티디바이스 PDF 뷰어**(`PdfViewer.tsx`, react-pdf): ReportPanel iframe 교체·lazy 로드·Mantine 툴바·모바일 새탭 폴백.

## 4. 원작자 데이터 분석 현황 (메인 병합)
- origin/main이 클론 후 **13커밋 전진**(원작자 wellbianlabs, 리포트/내보내기/KPI 고도화). → **`ea817de`로 전체 통합 완료**.
- **히스토리 정본화** `히스토리정본` — 75커밋 연대기 + **2대 피벗**:
  - **6/08 지도 제거** → "위험지도 미구현"은 *제거된 것*(README만 잔존).
  - **6/12 IoT·현재날씨 카드 제거 → 과거기록 분석 중심 피벗** → `/api/weather/current` 고아 엔드포인트 유래.
- 병합 충돌 3파일 해결: **App.tsx**(우리 Mantine+다운샘플1분제거·업로드일자fix) · **KpiCards.tsx**(Mantine+신KPI 위험단계지속·발생시각) · **ReportPanel.tsx**(원작자 웹보고서 신기능 보존=Tailwind, 아이콘만 tabler). 백엔드·api·types 자동병합(법정휴식 진단 등 흡수). 런타임 검증 콘솔 0.

## 5. 남은 작업 (우선순위)
1. **ReportPanel 전체 Mantine 재변환** — `재변환매칭정본` §1 (17섹션 매핑됨, PdfViewer는 이미 반영). 유일 잔존 Tailwind 화면.
2. **index.css 레거시(.card 등) 제거** — ReportPanel `.card` 제거와 동시(자동).
3. **App.tsx 구조 Tailwind(20)** — 헤더/메인/부팅. **본배선(라우팅) 결정과 묶기**.
4. **Tailwind 완전 제거(Phase 4)** — 위 1·3 후 tailwind config/@tailwind 제거 → Mantine 단일화.
5. **리뉴얼 본배선**(선택) — react-router + 실데이터/인증 → renew를 실 진입점으로.
6. **D1 리브랜딩 컨셉 택1** → theme.ts v2 / **D3 위험지도 Leaflet 정식화**(현 스켈레톤 v1.5) / **현재날씨 위젯 배선**(백엔드 준비됨).
7. **origin 푸시/PR** — 지시 시(프로덕션 자동배포 트리거).

## 6. 정본 문서 (리포 루트, 8종)
`분석정본` · `디자인개편_기획서` · `레이아웃설계` · `컴포넌트카탈로그_워크플로우` · `작업정본` · `히스토리정본` · `재변환매칭정본` · **`서버구축정본`**(자체호스팅 배포 런북) · (+본 `세션앵커`)

## 7. 재개 명령
```
# 서버 꺼졌으면:
cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 4343 --reload &
cd frontend && npx vite --port 9999 --strictPort --host 0.0.0.0 &
# 빌드/타입체크: cd frontend && npm run build
# 데모: 웹에서 "데모 계정으로 둘러보기" (시드 데이터 06-09~06-16)
```

*— 미선택 결정: 리브랜딩 컨셉(A Signal 추천)·라우팅 도입·외부비교 차트 기간조회·vite proxy 포트·문서커밋범위·푸시시점.*
