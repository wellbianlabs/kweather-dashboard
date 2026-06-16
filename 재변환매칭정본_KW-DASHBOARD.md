# Mantine 재변환 — 작업 대상 분석 & 매칭 정본

> 기준일: 2026-06-16 · 브랜치 `feature/mantine-migration` (origin/main 병합 후)
> "재변환" = **병합으로 되돌아온 Tailwind(원작자 ReportPanel) + 잔존 구조 Tailwind**를 Mantine으로 전환.
> 최종 목표: **Phase 4 — Tailwind 완전 제거**(컴포넌트는 이미 Mantine화 완료, 잔여만 정리).

---

## 0. 스캔 결과 (전수)

`className` 사용 파일(ui/ 이식·*.module.css 제외):

| 파일 | className 수 | 성격 | 재변환 대상? |
| --- | --- | --- | --- |
| **`components/ReportPanel.tsx`** | **101** | 병합으로 되돌아온 **원작자 웹보고서(Tailwind)** + 레거시 `.card` 유일 사용처 | ✅ **1순위** |
| **`App.tsx`** | **20** | 헤더·메인·부팅 등 **구조 레이아웃 Tailwind** | ✅ 2순위(구조) |
| `catalog/CatalogApp.tsx` | 1 | `.catalog-canvas` = **CSS변수 스코프 셀렉터(기능용, Tailwind 아님)** | ❌ 제외 |
| `renew/RenewApp.tsx`·`mockup/*` | 0 | 이미 Mantine(style props/inline) | ✅ 완료 |
| `components/ui/*` | 0 | Mantine UI 이식 = **CSS 모듈**(`light-dark()`) | ✅ 완료 |

→ **실 재변환 대상은 2개**(ReportPanel·App.tsx) + index.css 레거시 정리.

---

## 1. 1순위 — `ReportPanel.tsx` (섹션별 매칭)

> 병합 시 원작자 신기능(웹보고서: 4단계 노출시간·시간별 표/그래프·법정 휴식 진단) 보존을 위해 **Tailwind 원본 유지**(아이콘만 tabler 매핑). 기능·로직(`api.*`, `showPreview`, `WebReport`)은 **변경 없이** 스타일만 Mantine으로.

| # | 섹션 | 현재(Tailwind) | → Mantine 매칭 | 비고 |
| --- | --- | --- | --- | --- |
| 1 | 외곽 컨테이너 | `<div className="card">` | `<Paper radius="lg" p="lg" withBorder shadow="xs" pos="relative">` | 레거시 `.card` 제거의 핵심 |
| 2 | 생성중 오버레이 | `fixed inset-0 … spinner + 진행바` | `<Modal opened onClose withCloseButton={false} centered>` + `<Loader>` + `<Progress animated>` | (Phase2 변환본 패턴 재사용) |
| 3 | 헤더 | `<h3>` + `<p>` | `<Title order={3} fz="md">` + `<Text size="xs" c="dimmed">` | |
| 4 | 웹보고서 상태 | 로딩/미선택/없음 `<p>` | `<Text c="dimmed">` 상태 + `<WebReport/>` | |
| 5 | 변환/내보내기 버튼 3종 | `<button className={btn …}>` | `<Group><Button leftSection loading=… color/variant /></Group>` | daily=filled kw · periodic=default · excel=teal light. `btn` const 제거 |
| 6 | 오류 | `<p>` red box | `<Alert color="red" variant="light">` | |
| 7 | PDF 미리보기 박스 | `border + 헤더바 + iframe + 푸터` | `<Paper withBorder radius="md">` + `<Group>`(라벨/다운로드/닫기 `<Button>`) + `<iframe>`(유지) + `<Text>` | iframe 자체는 유지 |
| **WebReport 서브** | | | | |
| 8 | 외곽 | `border bg-white rounded` | `<Paper withBorder radius="lg">` | |
| 9 | 제목 밴드 | `border-b-2 border-kw text-center` | `<Box>` + `borderBottom: 2px kw` + `<Title>`/`<Text>` | |
| 10 | 문서정보(Info 행) | `flex 라벨/값 grid` | Mantine `<Table>`(key/value) 또는 `<SimpleGrid>` + `Info`→`<Group>` | |
| 11 | 측정결과 요약(Metric×3) | `grid sm:3 카드` | `<SimpleGrid cols={{base:1,sm:3}}>` + `Metric`→`<Paper p="md">` | |
| 12 | 위험단계별 노출 표 | `<table>` | Mantine `<Table>` (단계색 셀 style 유지) | |
| 13 | 시간별 표(24h) | `HourlyTable <table>` | Mantine `<Table>` + `<Table.ScrollContainer>` (셀 background=단계색 유지) | |
| 14 | 시간별 그래프 | `HourlyChart` recharts | **recharts 유지** + `chartkit`(커스텀 툴팁·축) 적용 | chartkit 재사용 |
| 15 | 법정 휴식 의무 | amber/slate box | `<Alert color="yellow" variant="light">` / `<Paper bg="gray.0">` | 신기능(보존) |
| 16 | 안전조치 가이드 | `<ul>` | `<List spacing="xs">` 또는 `<Stack>`+`<Group>` | |
| 17 | 푸터 노트 | `<p>` | `<Text size="xs" c="dimmed">` | |
| 18 | 헬퍼 | `btn` const, `Info`/`Metric`, `IconFile`/`IconSpinner` 래퍼 | `btn` 제거 · `Info`/`Metric` Mantine화 · 스피너→`<Loader>`/`loading` prop, 래퍼 제거 | `fmtMin`/`fill24` 유지 |

- **난이도**: 중(섹션 ~17개, 기계적) · **리스크**: 낮음(로직 무변경, recharts 내부 유지) · **효과**: 큼(앱 내 유일한 Tailwind 보고서 → Mantine 일관성 회복)
- **불변**: 단계색(연두/노랑/주황/빨강)·임계, `api.*`·`showPreview`/`downloadOnly`/`WebReport` 로직, iframe 미리보기.

---

## 2. 2순위 — `App.tsx` (구조 Tailwind)

> 레거시 컴포넌트 클래스(`.btn-*`)는 이미 Mantine화됨. 남은 20개는 **레이아웃 유틸리티**(헤더·메인·부팅).

| 영역 | 현재(Tailwind) | → 매칭 | 비고 |
| --- | --- | --- | --- |
| 헤더(sticky/logo/h1/flex) | `<header className="sticky …">` | `<Box component="header" pos="sticky">` + `<Group>` + `<Title>` **또는 AppShell.Header 승격** | 리뉴얼 AppShell과 중복 → **승격 시 자연 해소** |
| 메인 래퍼 | `<main className="mx-auto max-w-7xl …">` | `<Container size="xl">`+`<Stack>` | |
| 부팅 화면 | `<div className="flex min-h-screen …">` | `<Center h="100vh">`+`<Loader>` | |
| 컨트롤바 래퍼/구분선 | `<div className="border-b …">` 등 | `<Box>`/`<Divider orientation="vertical">` | 인풋은 이미 Mantine |
| 선택기기 정보 | `<div className="ml-auto text-right …">` | `<Box ta="right" ml="auto">`+`<Text>` | |
| STEP 안내/네비 | (이미 Mantine `<Paper>`/`<Button>`) | — | 완료 |

- **권고**: App.tsx 구조 Tailwind는 **(A) 그대로 Mantine 치환** 또는 **(B) 리뉴얼 AppShell로 승격(본배선)** 중 택1. (B)가 헤더·네비 중복을 한 번에 해소 → **본배선 결정과 묶어 처리** 권장.
- **난이도**: 중 · **리스크**: 낮음(레이아웃) · **의존**: 본배선(라우팅) 결정.

---

## 3. index.css 레거시 클래스 정리

```
.card .btn-primary .btn-ghost .input .select   (src/index.css @layer components)
```
- 현재 사용처: **ReportPanel `.card` 단 1곳**(§1-1). `.btn-*`/`.input`/`.select`는 **이미 미사용**.
- **§1(ReportPanel) 완료 직후 5개 클래스 전부 제거 가능** → index.css 대폭 축소.

---

## 4. Tailwind 완전 제거(Phase 4) 종료 조건
1. **ReportPanel 재변환**(§1) → 레거시 `.card` 제거 → index.css 정리(§3)
2. **App.tsx 구조 변환/승격**(§2)
3. 잔여 0 확인 후: `tailwind.config.js`·`postcss.config.js`의 tailwind 플러그인·`index.css`의 `@tailwind`/레이어 제거 → **Mantine 단일화 완료**

> 현재 Tailwind는 **CSS 캐스케이드 레이어로 Mantine과 충돌 없이 공존** 중이라 동작엔 문제 없음. 위 2개만 정리하면 완전 제거 가능.

---

## 5. 실행 우선순위 (권고)
| 순위 | 작업 | 효과 | 비고 |
| --- | --- | --- | --- |
| **1** | ReportPanel 재변환(§1) | 앱 일관성 회복(유일 Tailwind 화면) | 단독 가능, 즉시 착수 가능 |
| **2** | index.css 레거시 제거(§3) | 정리 | §1 직후 자동 |
| **3** | App.tsx 구조(§2) | Tailwind 완전 제거 전제 | **본배선(라우팅) 결정과 묶기** |
| **4** | Tailwind 의존 제거(§4) | 단일화 완료 | §1~3 후 |

---

## 6. 매칭 요약(정본)
- **재변환 실대상 = ReportPanel(1순위) + App.tsx 구조(2순위)** 뿐. 그 외(이식 ui/·리뉴얼·목업·기 전환 컴포넌트)는 **이미 Mantine**.
- ReportPanel은 **17개 섹션이 모두 Mantine 1:1 대응**(로직·recharts·단계색 보존). 리스크 낮음.
- index.css 레거시 5종은 ReportPanel `.card` 제거와 동시에 소멸.
- 완전 단일화는 위 2건 + Tailwind 의존 제거로 종료.

*— 본 문서는 2026-06-16 병합 직후 코드 전수 스캔에 근거한 재변환 대상·매칭 정본이다. §1 착수 시 갱신한다.*
