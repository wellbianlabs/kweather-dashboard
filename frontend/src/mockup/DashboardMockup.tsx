import {
  ActionIcon, Alert, Anchor, AppShell, Avatar, Badge, Box, Container, Divider,
  Grid, Group, NavLink, Paper, Select, SimpleGrid, Stack, Text, ThemeIcon,
  useComputedColorScheme, useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertTriangle, IconClockHour4, IconDeviceDesktopAnalytics, IconDroplet,
  IconFileText, IconFlame, IconLayoutDashboard, IconMap2, IconMenu2, IconMoon,
  IconSettings, IconShieldHalf, IconSun, IconTemperature, IconTrendingUp,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { TimeSeriesChart } from "../components/TimeSeriesChart";
import { WeatherCompareChart } from "../components/WeatherCompareChart";
import { HeatGuidelines } from "../components/HeatGuidelines";
import { mockKpi, mockTs, mockCmp } from "./data";

type IconType = ComponentType<{ size?: number | string }>;

const NAV: { icon: IconType; label: string; active?: boolean }[] = [
  { icon: IconLayoutDashboard, label: "대시보드", active: true },
  { icon: IconMap2, label: "위험 지도" },
  { icon: IconFileText, label: "리포트" },
  { icon: IconDeviceDesktopAnalytics, label: "기기 · 사업장" },
  { icon: IconSettings, label: "설정" },
];

export function DashboardMockup() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const [desktopOpened] = useDisclosure(true);
  const { toggleColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 248, breakpoint: "md", collapsed: { mobile: !mobileOpened, desktop: !desktopOpened } }}
        padding="md"
      >
        {/* ── Header ───────────────────────────────────────── */}
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" hiddenFrom="md" onClick={toggleMobile} aria-label="menu">
                <IconMenu2 size={20} />
              </ActionIcon>
              <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
            </Group>

            {/* 컨텍스트 바 (기기/일자/기간) — md 이상 */}
            <Group gap="xs" visibleFrom="md" wrap="nowrap">
              <Select size="xs" w={220} defaultValue="DEMO-A001 · 제2공장 정련로 앞" allowDeselect={false}
                data={["DEMO-A001 · 제2공장 정련로 앞", "DEMO-A002 · 압연공정 라인 B", "(전체 사업장)"]} />
              <Select size="xs" w={130} defaultValue="2026-06-16" allowDeselect={false}
                data={["2026-06-16", "2026-06-15", "2026-06-14"]} />
              <Select size="xs" w={120} defaultValue="최근 7일" allowDeselect={false}
                data={["오늘", "최근 7일", "이번 달"]} />
            </Group>

            <Group gap="xs" wrap="nowrap">
              <ActionIcon variant="default" onClick={toggleColorScheme} aria-label="theme">
                {computed === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
              <Avatar size={30} radius="xl" color="kw" variant="filled">안</Avatar>
            </Group>
          </Group>
        </AppShell.Header>

        {/* ── Navbar (데스크톱 사이드바) ───────────────────── */}
        <AppShell.Navbar p="sm">
          <Stack gap={2}>
            {NAV.map((n) => (
              <NavLink key={n.label} label={n.label} active={n.active}
                leftSection={<n.icon size={18} />} variant="filled" />
            ))}
            <Divider my="xs" />
            <NavLink label="관리자" leftSection={<IconShieldHalf size={18} />} color="gray" />
          </Stack>
          <Box style={{ marginTop: "auto" }} pt="md">
            <Text size="xs" c="dimmed">체감온도 데이터 분석 프로그램</Text>
          </Box>
        </AppShell.Navbar>

        {/* ── Main ─────────────────────────────────────────── */}
        <AppShell.Main>
          <Container size={1440} px={0}>
            <Box pb={{ base: 84, md: 0 }}>
              <DashboardContent />
            </Box>
          </Container>
        </AppShell.Main>
      </AppShell>

      {/* ── Bottom Tab (모바일 전용) ───────────────────────── */}
      <Box hiddenFrom="md" px="md" py={6}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 200,
          borderTop: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-body)",
        }}>
        <Group justify="space-between">
          <TabItem icon={IconLayoutDashboard} label="대시보드" active />
          <TabItem icon={IconMap2} label="지도" />
          <TabItem icon={IconFileText} label="리포트" />
          <TabItem icon={IconMenu2} label="더보기" />
        </Group>
      </Box>
    </>
  );
}

function DashboardContent() {
  return (
    <Stack gap="md">
      {/* 모바일 컨텍스트 칩 */}
      <Group hiddenFrom="md" gap="xs">
        <Badge variant="light" color="gray" radius="sm" size="lg">DEMO-A001</Badge>
        <Badge variant="light" color="gray" radius="sm" size="lg">2026-06-16</Badge>
        <Badge variant="light" color="gray" radius="sm" size="lg">최근 7일</Badge>
      </Group>

      {/* Row 1: RiskHero (8) + 현재 외부날씨 (4) */}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 8 }}><RiskHero /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}><CurrentWeatherWidget /></Grid.Col>
      </Grid>

      {/* Row 2: KPI v2 ×4 */}
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
        <KpiTile icon={IconTemperature} label="최고 체감온도" value="38.6" unit="℃" delta="▲ 1.4 vs 전일" deltaColor="red" />
        <KpiTile icon={IconTemperature} label="최고 온도" value="36.2" unit="℃" delta="▲ 0.9 vs 전일" deltaColor="red" />
        <KpiTile icon={IconClockHour4} label="38℃↑ 누적" value="84" unit="분" delta="위험단계 노출" deltaColor="red" />
        <KpiTile icon={IconDroplet} label="평균 습도" value="68" unit="%" delta="고온다습 가중" deltaColor="dimmed" />
      </SimpleGrid>

      {/* Row 3: 시계열 (12) */}
      <TimeSeriesChart ts={mockTs} kpi={mockKpi} date="2026-06-16" />

      {/* Row 4: 내·외부 비교 (7) + 위험지도 미니 (5) */}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 7 }}><WeatherCompareChart cmp={mockCmp} /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}><RiskMapMini /></Grid.Col>
      </Grid>

      {/* Row 5: 폭염 단계별 안전조치 (12) */}
      <HeatGuidelines kpi={mockKpi} />
    </Stack>
  );
}

function RiskHero() {
  const lvl = mockKpi.current_level;
  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs" h="100%" style={{ borderLeft: `5px solid ${lvl.color}` }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">현재 폭염 위험 단계</Text>
          <Group gap="sm" align="center" mt={8} wrap="nowrap">
            <Badge size="xl" radius="md" styles={{ root: { background: lvl.color, color: "#fff" } }}>{lvl.label}</Badge>
            <Text fz={44} fw={800} lh={1} c={lvl.color}>36.4<Text span fz={18} fw={700}>℃</Text></Text>
            <Group gap={2} c="red" wrap="nowrap"><IconTrendingUp size={18} /><Text fw={700} size="sm">+2.1</Text></Group>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">현장 체감온도 · 측정 09:40 · DEMO-A001 / 제2공장 정련로 앞</Text>
        </Box>
        <ThemeIcon size={56} radius="md" variant="light" color="red"><IconFlame size={30} /></ThemeIcon>
      </Group>
      <Divider my="md" />
      <Group gap={0} grow>
        <HeroStat label="최고 체감" value="38.6℃" />
        <HeroStat label="38℃↑ 누적" value="84분" />
        <HeroStat label="권고 조치" value="옥외작업 중지" />
      </Group>
    </Paper>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700} fz="lg" mt={2}>{value}</Text>
    </Box>
  );
}

function CurrentWeatherWidget() {
  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs" h="100%">
      <Group justify="space-between">
        <Text fw={600} fz="md">현재 외부 날씨</Text>
        <Badge variant="light" color="sky">케이웨더</Badge>
      </Group>
      <Group mt="md" gap="xl">
        <Box>
          <Text size="xs" c="dimmed">외부 기온</Text>
          <Text fz={28} fw={800} lh={1.1}>31.2℃</Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">외부 체감</Text>
          <Text fz={28} fw={800} lh={1.1} c="sky">32.8℃</Text>
        </Box>
      </Group>
      <Divider my="sm" />
      <Group justify="space-between">
        <Text size="sm" c="dimmed">현장 내부 체감</Text>
        <Text fw={700}>36.4℃</Text>
      </Group>
      <Alert mt="sm" p="xs" color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
        <Text size="xs">밀폐형 폭염 — 내부가 외부 대비 <b>+5.2℃</b> 높음</Text>
      </Alert>
      <Text size="xs" c="dimmed" mt="xs">부산 사하구 · 관측 09:00</Text>
    </Paper>
  );
}

function KpiTile({ icon: Icon, label, value, unit, delta, deltaColor }:
  { icon: IconType; label: string; value: string; unit: string; delta: string; deltaColor: string }) {
  return (
    <Paper radius="lg" p="md" withBorder shadow="xs">
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed" fw={600}>{label}</Text>
        <ThemeIcon size="sm" variant="light" color="gray"><Icon size={14} /></ThemeIcon>
      </Group>
      <Group align="flex-end" gap={4} mt="xs">
        <Text fz={26} fw={800} lh={1}>{value}</Text>
        <Text size="sm" c="dimmed" mb={2}>{unit}</Text>
      </Group>
      <Text size="xs" c={deltaColor} mt={4} fw={600}>{delta}</Text>
    </Paper>
  );
}

function RiskMapMini() {
  return (
    <Paper radius="lg" withBorder shadow="xs" h="100%" style={{ overflow: "hidden", minHeight: 260 }}>
      <Group justify="space-between" p="md" pb="xs">
        <Text fw={600} fz="md">위험 지도</Text>
        <Anchor size="sm">전체 보기 →</Anchor>
      </Group>
      <Box mx="md" mb="md" style={{ position: "relative", height: 196, borderRadius: 12, background: "linear-gradient(135deg,#e8eef5,#d7e3f0)" }}>
        <Marker x="28%" y="38%" color="#dc2626" />
        <Marker x="60%" y="54%" color="#facc15" />
        <Marker x="46%" y="72%" color="#84cc16" />
        <Text style={{ position: "absolute", right: 10, bottom: 6 }} size="xs" c="dimmed">Leaflet 연동 예정 (D3)</Text>
      </Box>
    </Paper>
  );
}

function Marker({ x, y, color }: { x: string; y: string; color: string }) {
  return (
    <Box style={{
      position: "absolute", left: x, top: y, width: 16, height: 16, borderRadius: 999,
      background: color, border: "3px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.3)", transform: "translate(-50%,-50%)",
    }} />
  );
}

function TabItem({ icon: Icon, label, active }: { icon: IconType; label: string; active?: boolean }) {
  return (
    <Stack gap={2} align="center" style={{ flex: 1, color: active ? "var(--mantine-color-kw-6)" : "var(--mantine-color-dimmed)" }}>
      <Icon size={20} />
      <Text fz={10} fw={active ? 700 : 500}>{label}</Text>
    </Stack>
  );
}
