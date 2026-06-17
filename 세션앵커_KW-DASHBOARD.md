# 세션 앵커 (Resume Checkpoint) — KW-DASHBOARD

> 작성: 2026-06-17 · 컨텍스트 압축 대비 재개점. **여기부터 이어서 작업.**
> 브랜치 `Dev` (= feature/mantine-migration, **origin/Dev 추적** · main 미푸시 = 프로덕션 무변경)

## 0. 06-17 세션 추가 완료 (이 배너 우선 확인)
- **GitHub `Dev` 브랜치 생성·push**(origin/Dev). gh CLI(`wellbianlabs`) 인증 구성됨.
- **Tailwind 완전 제거·Mantine 단일화(Phase 4)** — 커밋 `7afa002`. ReportPanel 17섹션 재변환 · App.tsx 구조 · index.css/postcss/config/deps 정리. (상세 `재변환매칭정본` ✅완료)
- **#5 리뉴얼 실 진입점 승격** — react-router + 인증 게이트 + 실데이터 배선. `index.html`→`RenewRoot`. 라우트 `/`·`/map`·`/report`·`/devices`·`/settings`·`/admin`. 컨텍스트바·다크모드·모바일탭. 실렌더 검증 콘솔에러 0(`design_screenshots/renew_*.png`).
  - 신규: `src/renew/{DashboardProvider,RenewRoot}.tsx` + `src/renew/pages/{Dashboard,Map,Report,Devices,Settings}Page.tsx`. ui/ NavbarNested·LinksGroup·AccountButton 라우터-인지화.
  - **미푸시 결정**: 사용자 "로컬만 유지" · **리브랜딩(#6) 보류**(theme v2/다크 컨셉 나중).
  - **남은 폴리시(#5 후속)**: DataTable·RiskMapSkeleton 실데이터 미배선(데모) · DataTable 다크모드 색 · `App.tsx`(구 위저드)·`renew.html`/`renew.tsx`/구 `RenewApp` = **고아**(승격으로 대체, 추후 제거) · BrowserRouter SPA fallback(백엔드 서빙 시 catch-all 필요).

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

## 6. 정본 문서 (리포 루트, 7종)
`분석정본` · `디자인개편_기획서` · `레이아웃설계` · `컴포넌트카탈로그_워크플로우` · `작업정본` · `히스토리정본` · `재변환매칭정본` · (+본 `세션앵커`)

## 7. 재개 명령
```
# 서버 꺼졌으면:
cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 4343 --reload &
cd frontend && npx vite --port 9999 --strictPort --host 0.0.0.0 &
# 빌드/타입체크: cd frontend && npm run build
# 데모: 웹에서 "데모 계정으로 둘러보기" (시드 데이터 06-09~06-16)
```

*— 미선택 결정: 리브랜딩 컨셉(A Signal 추천)·라우팅 도입·외부비교 차트 기간조회·vite proxy 포트·문서커밋범위·푸시시점.*
