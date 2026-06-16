// 프론트 리뉴얼 — 이식한 Mantine UI 컴포넌트를 실제 레이아웃에 전면 반영.
// AppShell + AppNavbar(이식) + StatsGrid(이식) + AccountButton(이식) + DataTable(이식) + SiteFooterLinks(이식)
// + RiskHero/CurrentWeather(커스텀) + 실제 차트/안전가이드(recharts·도메인).
import {
  ActionIcon, AppShell, Badge, Box, Container, Divider, Grid, Group,
  Paper, Stack, Text, ThemeIcon, Title, Select,
  useComputedColorScheme, useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertTriangle, IconFileText, IconFlame, IconLayoutDashboard,
  IconMap2, IconMenu2, IconMoon, IconSun, IconTrendingUp,
} from "@tabler/icons-react";
import { NavbarNested } from "../components/ui/NavbarNested";
import { KpiCards } from "../components/KpiCards";
import { DataTable } from "../components/ui/DataTable";
import { SiteFooterLinks } from "../components/ui/SiteFooterLinks";
import { RiskMapSkeleton } from "../components/RiskMapSkeleton";
import { TimeSeriesChart } from "../components/TimeSeriesChart";
import { WeatherCompareChart } from "../components/WeatherCompareChart";
import { HeatGuidelines } from "../components/HeatGuidelines";
import { mockKpi, mockTs, mockCmp } from "../mockup/data";

export function RenewApp() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const { toggleColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 280, breakpoint: "md", collapsed: { mobile: !mobileOpened } }}
        padding="md"
        withBorder={false}
      >
        <AppShell.Header style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" hiddenFrom="md" onClick={toggleMobile} aria-label="menu">
                <IconMenu2 size={20} />
              </ActionIcon>
              <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 22 }} />
            </Group>

            <Group gap="xs" visibleFrom="md" wrap="nowrap">
              <Select size="xs" w={210} allowDeselect={false} defaultValue="DEMO-A001 · 제2공장 정련로 앞"
                data={["DEMO-A001 · 제2공장 정련로 앞", "DEMO-A002 · 압연공정 라인 B", "(전체 사업장)"]} />
              <Select size="xs" w={130} allowDeselect={false} defaultValue="2026-06-16"
                data={["2026-06-16", "2026-06-15", "2026-06-14"]} />
            </Group>

            <Group gap="xs" wrap="nowrap">
              <ActionIcon variant="default" onClick={toggleColorScheme} aria-label="theme">
                {computed === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Group>
          </Group>
        </AppShell.Header>

        {/* 이식: AppNavbar 사이드바 */}
        <AppShell.Navbar p={0}>
          <NavbarNested />
        </AppShell.Navbar>

        <AppShell.Main>
          <Container size={1440} px={0}>
            <Box pb={{ base: 84, md: 0 }}>
              <Stack gap="md">
                <Grid gap="md">
                  <Grid.Col span={{ base: 12, md: 8 }}><RiskHero /></Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}><CurrentWeatherWidget /></Grid.Col>
                </Grid>

                {/* 병합 동기화: 실 KpiCards — 위험단계·최고체감(발생시각)·최고온도(발생시각)·위험단계 지속(38℃↑) */}
                <KpiCards kpi={mockKpi} />

                <TimeSeriesChart ts={mockTs} kpi={mockKpi} date="2026-06-16" />

                <Grid gap="md">
                  <Grid.Col span={{ base: 12, md: 7 }}><WeatherCompareChart cmp={mockCmp} /></Grid.Col>
                  <Grid.Col span={{ base: 12, md: 5 }}><RiskMapSkeleton compact height={208} /></Grid.Col>
                </Grid>

                {/* 이식: DataTable (sticky 헤더) */}
                <Paper withBorder radius="lg" p="lg" shadow="xs">
                  <Title order={3} fz="md" c="#0f172a" mb="sm">사업장별 현재 위험 현황</Title>
                  <DataTable />
                </Paper>

                <HeatGuidelines kpi={mockKpi} />

                {/* 이식: SiteFooterLinks */}
                <SiteFooterLinks />
              </Stack>
            </Box>
          </Container>
        </AppShell.Main>
      </AppShell>

      {/* 모바일 하단 탭 */}
      <Box hiddenFrom="md" px="md" py={6}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 200,
          borderTop: "1px solid var(--mantine-color-default-border)", background: "var(--mantine-color-body)",
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
      <Group justify="space-between"><Text fw={600} fz="md">현재 외부 날씨</Text><Badge variant="light" color="sky">케이웨더</Badge></Group>
      <Group mt="md" gap="xl">
        <Box><Text size="xs" c="dimmed">외부 기온</Text><Text fz={28} fw={800} lh={1.1}>31.2℃</Text></Box>
        <Box><Text size="xs" c="dimmed">외부 체감</Text><Text fz={28} fw={800} lh={1.1} c="sky">32.8℃</Text></Box>
      </Group>
      <Divider my="sm" />
      <Group justify="space-between"><Text size="sm" c="dimmed">현장 내부 체감</Text><Text fw={700}>36.4℃</Text></Group>
      <Box mt="sm" p="xs" style={{ background: "var(--mantine-color-red-light)", borderRadius: 8 }}>
        <Group gap={6} wrap="nowrap"><IconAlertTriangle size={16} color="var(--mantine-color-red-6)" /><Text size="xs" c="red.7">밀폐형 폭염 — 내부가 외부 대비 <b>+5.2℃</b> 높음</Text></Group>
      </Box>
      <Text size="xs" c="dimmed" mt="xs">부산 사하구 · 관측 09:00</Text>
    </Paper>
  );
}

function TabItem({ icon: Icon, label, active }: { icon: typeof IconMap2; label: string; active?: boolean }) {
  return (
    <Stack gap={2} align="center" style={{ flex: 1, color: active ? "var(--mantine-color-kw-6)" : "var(--mantine-color-dimmed)" }}>
      <Icon size={20} />
      <Text fz={10} fw={active ? 700 : 500}>{label}</Text>
    </Stack>
  );
}
