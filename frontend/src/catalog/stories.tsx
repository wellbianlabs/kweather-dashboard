import type { ReactNode } from "react";
import { Badge, Box, Button, Group, Stack, Text } from "@mantine/core";
import { HeatBadge } from "../components/HeatBadge";
import { KpiCards } from "../components/KpiCards";
import { HeatGuidelines } from "../components/HeatGuidelines";
import { TimeSeriesChart } from "../components/TimeSeriesChart";
import { WeatherCompareChart } from "../components/WeatherCompareChart";
import { Stepper } from "../components/Stepper";
import { UploadPanel } from "../components/UploadPanel";
import { DeviceRegister } from "../components/DeviceRegister";
import { ReportPanel } from "../components/ReportPanel";
import { SiteFooter } from "../components/SiteFooter";
import { RiskMapSkeleton } from "../components/RiskMapSkeleton";
import { AppNavbar } from "../components/ui/AppNavbar";
import { NavbarNested } from "../components/ui/NavbarNested";
import { StatsGrid as UiStatsGrid } from "../components/ui/StatsGrid";
import { AccountButton } from "../components/ui/AccountButton";
import { DataTable } from "../components/ui/DataTable";
import { SiteFooterLinks } from "../components/ui/SiteFooterLinks";
import { mockKpi, mockTs, mockCmp, mockTsWeek } from "../mockup/data";
import type { Device, HeatLevel, Kpi } from "../types";

// ── 노브 / 스토리 타입 ─────────────────────────────────────────
export type Knob =
  | { type: "select"; key: string; label: string; options: string[]; default: string }
  | { type: "boolean"; key: string; label: string; default: boolean }
  | { type: "number"; key: string; label: string; default: number; min?: number; max?: number; step?: number }
  | { type: "text"; key: string; label: string; default: string };

export type Story = {
  id: string;
  group: string;
  title: string;
  desc?: string;
  file?: string; // 수정 대상 파일(지시문에 포함)
  knobs?: Knob[];
  render: (k: Record<string, any>) => ReactNode;
};

// ── 목 데이터 ─────────────────────────────────────────────────
const HEAT: Record<string, HeatLevel> = {
  safe: { code: "safe", label: "안전", color: "#16a34a", rank: 0 },
  attention: { code: "attention", label: "관심", color: "#84cc16", rank: 1 },
  caution: { code: "caution", label: "주의", color: "#facc15", rank: 2 },
  warning: { code: "warning", label: "경고", color: "#f97316", rank: 3 },
  danger: { code: "danger", label: "위험", color: "#dc2626", rank: 4 },
};
const withLevel = (kpi: Kpi, lvl: string): Kpi => ({ ...kpi, current_level: HEAT[lvl] ?? kpi.current_level });

const mockDevices: Device[] = [
  { device_sn: "DEMO-A001", company_name: "데모 제강(주)", location_name: "제2공장 정련로 앞", address: "부산 사하구 다대로", latitude: 35.0966, longitude: 128.9663, region_code: "2638051000" },
  { device_sn: "DEMO-B001", company_name: "데모 물류(주)", location_name: "옥외 상하차장", address: "경기 평택시 포승읍", latitude: 36.992, longitude: 126.84, region_code: "4122033000" },
];

// 공용 노브
const sizeKnob: Knob = { type: "select", key: "size", label: "size", options: ["sm", "md", "lg"], default: "md" };
const levelKnob: Knob = { type: "select", key: "level", label: "위험단계", options: ["safe", "attention", "caution", "warning", "danger"], default: "danger" };

// ── 파운데이션 미리보기 ───────────────────────────────────────
function ColorTokens() {
  const ramp = (name: string) => (
    <div>
      <Text size="xs" c="dimmed" mb={4}>{name}</Text>
      <Group gap={4}>
        {Array.from({ length: 10 }, (_, i) => (
          <Stack key={i} gap={2} align="center">
            <Box w={36} h={36} style={{ borderRadius: 8, background: `var(--mantine-color-${name}-${i})`, border: "1px solid var(--mantine-color-default-border)" }} />
            <Text fz={9} c="dimmed">{i}</Text>
          </Stack>
        ))}
      </Group>
    </div>
  );
  const heat = (
    <div>
      <Text size="xs" c="dimmed" mb={4}>heat (불변 · 정부 표준)</Text>
      <Group gap={8}>
        {Object.values(HEAT).map((h) => (
          <Stack key={h.code} gap={2} align="center">
            <Box w={48} h={36} style={{ borderRadius: 8, background: h.color }} />
            <Text fz={9} c="dimmed">{h.label}</Text>
          </Stack>
        ))}
      </Group>
    </div>
  );
  return <Stack gap="md">{ramp("kw")}{ramp("sky")}{heat}</Stack>;
}

function TypeScale() {
  return (
    <Stack gap={6}>
      <Text fz={40} fw={800} lh={1}>Display 40 · 폭염 36.4℃</Text>
      <Text fz={28} fw={800}>Heading 28 · 안전관리 대시보드</Text>
      <Text fz={20} fw={700}>Title 20 · 시계열 분석</Text>
      <Text fz={16} fw={600}>Subtitle 16 · 측정 결과 요약</Text>
      <Text fz={14}>Body 14 · 근무시간(09~18시) 중 최고 체감온도는…</Text>
      <Text fz={12} c="dimmed">Caption 12 · 데이터 제공: 케이웨더(주)</Text>
      <Text ff="monospace" fz={14}>Data-mono · 2026-06-16 09:40 · 38.6℃</Text>
    </Stack>
  );
}

// ── 스토리 레지스트리 ─────────────────────────────────────────
export const STORIES: Story[] = [
  // 파운데이션
  { id: "color", group: "파운데이션", title: "컬러 토큰", file: "src/theme.ts", desc: "브랜드 팔레트(kw·sky)와 불변 단계색. 상단에서 프리셋을 바꾸면 즉시 반영됩니다.", render: () => <ColorTokens /> },
  { id: "type", group: "파운데이션", title: "타이포그래피", file: "src/theme.ts", render: () => <TypeScale /> },
  {
    id: "button", group: "파운데이션", title: "Button", file: "src/theme.ts (Button 기본) / 사용처",
    knobs: [
      { type: "select", key: "variant", label: "variant", options: ["filled", "light", "default", "outline", "subtle"], default: "filled" },
      { type: "select", key: "color", label: "color", options: ["kw", "sky", "red", "teal", "gray"], default: "kw" },
      sizeKnob,
      { type: "boolean", key: "disabled", label: "disabled", default: false },
    ],
    render: (k) => (
      <Group>
        <Button variant={k.variant} color={k.color} size={k.size} disabled={k.disabled}>버튼</Button>
        <Button variant={k.variant} color={k.color} size={k.size} disabled={k.disabled}>다운로드</Button>
      </Group>
    ),
  },
  {
    id: "badge", group: "파운데이션", title: "Badge · HeatBadge", file: "src/components/HeatBadge.tsx",
    knobs: [sizeKnob, levelKnob],
    render: (k) => (
      <Group>
        <Badge color="kw">기본 Badge</Badge>
        <Badge color="sky" variant="light">light</Badge>
        <HeatBadge level={HEAT[k.level]} size={k.size as any} />
      </Group>
    ),
  },
  // 대시보드
  {
    id: "kpi", group: "대시보드", title: "KPI 카드", file: "src/components/KpiCards.tsx",
    knobs: [{ type: "boolean", key: "hasData", label: "데이터 있음", default: true }, levelKnob],
    render: (k) => <KpiCards kpi={k.hasData ? withLevel(mockKpi, k.level) : null} />,
  },
  {
    id: "guidelines", group: "대시보드", title: "폭염 단계별 안전조치", file: "src/components/HeatGuidelines.tsx",
    knobs: [levelKnob],
    render: (k) => <HeatGuidelines kpi={withLevel(mockKpi, k.level)} />,
  },
  { id: "ts", group: "대시보드", title: "시계열 차트 (1일)", file: "src/components/TimeSeriesChart.tsx", render: () => <TimeSeriesChart ts={mockTs} kpi={mockKpi} date="2026-06-16" /> },
  { id: "ts-week", group: "대시보드", title: "시계열 차트 (N일·일자 라벨)", file: "src/components/TimeSeriesChart.tsx · chartkit.tsx", desc: "기간이 여러 날이면 X축이 시:분 → 일자(M/D) 라벨로 자동 전환되고, 자정마다 구분선이 표시됩니다. 상단도 '측정기간'으로 전환.", render: () => <TimeSeriesChart ts={mockTsWeek} kpi={mockKpi} /> },
  {
    id: "cmp", group: "대시보드", title: "내·외부 비교 차트", file: "src/components/WeatherCompareChart.tsx",
    knobs: [{ type: "boolean", key: "enclosed", label: "밀폐 경고", default: true }],
    render: (k) => <WeatherCompareChart cmp={{ ...mockCmp, enclosed_alert: k.enclosed }} />,
  },
  { id: "riskmap", group: "대시보드", title: "위험 지도 (스켈레톤)", file: "src/components/RiskMapSkeleton.tsx", desc: "위경도→상대좌표 투영 + 폭염 단계색 마커. 의존성 0(Leaflet 미설치). 마커 hover 시 기기·체감·단계. 정식 Leaflet 지도(D3) 이전 경량 v1.", render: () => <RiskMapSkeleton /> },
  // 네비/플로우
  {
    id: "stepper", group: "네비/플로우", title: "Stepper", file: "src/components/Stepper.tsx",
    knobs: [{ type: "number", key: "step", label: "current", default: 3, min: 1, max: 4, step: 1 }, { type: "boolean", key: "canDash", label: "canDashboard", default: true }],
    render: (k) => <Stepper current={k.step as any} onJump={() => {}} canDashboard={k.canDash} />,
  },
  // 입력
  { id: "upload", group: "입력", title: "업로드 패널 (Dropzone)", file: "src/components/UploadPanel.tsx", render: () => <UploadPanel devices={mockDevices} onUploaded={() => {}} onReset={() => {}} /> },
  { id: "devices", group: "입력", title: "기기 등록·관리", file: "src/components/DeviceRegister.tsx · DeviceManager.tsx", render: () => <DeviceRegister devices={mockDevices} defaultCompany="데모 제강(주)" onChange={() => {}} /> },
  // 리포트
  {
    id: "report", group: "리포트", title: "리포트 패널", file: "src/components/ReportPanel.tsx",
    knobs: [{ type: "boolean", key: "hasDevice", label: "기기 선택됨", default: false }],
    desc: "기기 선택 시 일일 보고서 미리보기를 API에서 불러옵니다(카탈로그는 인증이 없어 미리보기는 비어보일 수 있음 — 버튼/레이아웃 디자인 확인용).",
    render: (k) => <ReportPanel deviceSn={k.hasDevice ? "DEMO-A001" : null} date="2026-06-16" rangeStart="2026-06-09" rangeEnd="2026-06-16" />,
  },
  // 기타
  { id: "footer", group: "기타", title: "사이트 푸터 · 몰 배너", file: "src/components/SiteFooter.tsx", render: () => <SiteFooter withBanner /> },

  // Mantine UI 이식 (ui.mantine.dev · MIT — 디자인 그대로, 브랜드 kw·한국어 적용)
  { id: "ui-navbar", group: "Mantine UI 이식", title: "사이드바 네비 (Navbar simple)", file: "src/components/ui/AppNavbar.tsx", desc: "Mantine UI 'Navbar simple' 이식 — 우리 IA·브랜드(kw)·로고 적용.", render: () => <AppNavbar /> },
  { id: "ui-navbar-nested", group: "Mantine UI 이식", title: "사이드바 네비 (Navbar nested) ★리뉴얼 적용", file: "src/components/ui/NavbarNested.tsx · NavbarLinksGroup.tsx", desc: "Mantine UI 'NavbarNested' 이식 — 리포트/설정/관리자 하위메뉴 접힘 + 푸터 계정. 리뉴얼 사이드바에 적용됨.", render: () => <Box h={600} maw={280}><NavbarNested /></Box> },
  { id: "ui-stats", group: "Mantine UI 이식", title: "KPI 그리드 (Stats grid)", file: "src/components/ui/StatsGrid.tsx", desc: "Mantine UI 'Stats grid' 이식 — 폭염 KPI·전일 대비 증감.", render: () => <UiStatsGrid /> },
  { id: "ui-account", group: "Mantine UI 이식", title: "계정 버튼 (User button)", file: "src/components/ui/AccountButton.tsx", desc: "Mantine UI 'User button' 이식 — 헤더/네비 계정.", render: () => <Box maw={320}><AccountButton /></Box> },
  { id: "ui-table", group: "Mantine UI 이식", title: "데이터 테이블 (sticky 헤더)", file: "src/components/ui/DataTable.tsx", desc: "Mantine UI 'Table with scroll area' 이식 — 스크롤 시 헤더 고정+그림자.", render: () => <DataTable /> },
  { id: "ui-footer", group: "Mantine UI 이식", title: "푸터 (Footer with links)", file: "src/components/ui/SiteFooterLinks.tsx", desc: "Mantine UI 'Footer with links' 이식 — 케이웨더 링크/카피라이트.", render: () => <SiteFooterLinks /> },
];
