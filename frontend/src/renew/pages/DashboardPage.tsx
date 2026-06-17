// 대시보드 페이지 — 위험 히어로·현재날씨·KPI·차트·지도 미니·안전가이드 (실데이터 배선).
import {
  Badge, Box, Divider, Grid, Group, Paper, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import { IconAlertTriangle, IconFlame } from "@tabler/icons-react";
import { KpiCards } from "../../components/KpiCards";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { HeatGuidelines } from "../../components/HeatGuidelines";
import { RiskMapSkeleton } from "../../components/RiskMapSkeleton";
import { DataTable } from "../../components/ui/DataTable";
import type { Kpi, WeatherCompare } from "../../types";
import { useDashboard } from "../DashboardProvider";
import { toRiskSites, toSiteRows } from "../siteAdapters";

function fmtMin(min?: number | null): string {
  if (!min || min <= 0) return "0분";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const ACTION_BY_RANK: Record<number, string> = {
  0: "정상 작업",
  1: "수분·휴식 권장",
  2: "매시간 휴식",
  3: "작업 단축·교대",
  4: "옥외작업 중지",
};

export function DashboardPage() {
  const { kpi, ts, cmp, date, selected, deviceSn, sites } = useDashboard();
  return (
    <Stack gap="md">
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <RiskHero kpi={kpi} subtitle={selected ? `${selected.device_sn} / ${selected.location_name ?? selected.address ?? ""}` : (deviceSn ?? "전체 사업장")} measuredAt={kpi?.max_feels_like_time ?? null} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <CurrentWeatherWidget cmp={cmp} kpi={kpi} />
        </Grid.Col>
      </Grid>

      <KpiCards kpi={kpi} />

      <TimeSeriesChart ts={ts} cmp={cmp} kpi={kpi} date={date} />

      <RiskMapSkeleton sites={toRiskSites(sites)} compact height={240} />

      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">사업장별 현재 위험 현황</Title>
        <DataTable rows={toSiteRows(sites)} />
      </Paper>

      <HeatGuidelines kpi={kpi} />
    </Stack>
  );
}

function RiskHero({ kpi, subtitle, measuredAt }: { kpi: Kpi | null; subtitle: string; measuredAt: string | null }) {
  const lvl = kpi?.current_level;
  const color = lvl?.color ?? "var(--mantine-color-gray-5)";
  const feels = kpi?.max_feels_like;
  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs" h="100%" style={{ borderLeft: `5px solid ${color}` }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">위험 단계 (기간 내 최고 체감 기준)</Text>
          <Group gap="sm" align="center" mt={8} wrap="nowrap">
            <Badge size="xl" radius="md" styles={{ root: { background: color, color: "#fff" } }}>{lvl?.label ?? "데이터 없음"}</Badge>
            <Text fz={44} fw={800} lh={1} c={color}>
              {feels != null ? feels : "–"}<Text span fz={18} fw={700}>℃</Text>
            </Text>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">현장 체감온도{measuredAt ? ` · 최고 ${measuredAt}` : ""} · {subtitle}</Text>
        </Box>
        <ThemeIcon size={56} radius="md" variant="light" color={(lvl?.rank ?? 0) >= 3 ? "red" : "kw"}>
          <IconFlame size={30} />
        </ThemeIcon>
      </Group>
      <Divider my="md" />
      <Group gap={0} grow>
        <HeroStat label="최고 체감" value={feels != null ? `${feels}℃` : "–"} />
        <HeroStat label="38℃↑ 누적" value={fmtMin(kpi?.danger_minutes)} />
        <HeroStat label="권고 조치" value={ACTION_BY_RANK[lvl?.rank ?? 0] ?? "–"} />
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

/** 마지막 유효 측정 포인트 추출. */
function lastPoint(cmp: WeatherCompare | null) {
  if (!cmp?.points?.length) return null;
  for (let i = cmp.points.length - 1; i >= 0; i--) {
    const p = cmp.points[i];
    if (p.outdoor_temperature != null || p.indoor_feels_like != null) return p;
  }
  return null;
}

function CurrentWeatherWidget({ cmp, kpi }: { cmp: WeatherCompare | null; kpi: Kpi | null }) {
  const p = lastPoint(cmp);
  const provider = cmp?.provider ?? "케이웨더";
  const enclosed = cmp?.enclosed_alert ?? false;
  const delta = cmp?.max_delta;
  const loc = kpi?.location_name ?? kpi?.company_name ?? "";
  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs" h="100%">
      <Group justify="space-between">
        <Text fw={600} fz="md">외부 날씨 비교</Text>
        <Badge variant="light" color="sky">{provider}</Badge>
      </Group>
      <Group mt="md" gap="xl">
        <Box>
          <Text size="xs" c="dimmed">외부 기온</Text>
          <Text fz={28} fw={800} lh={1.1}>{p?.outdoor_temperature != null ? `${p.outdoor_temperature}℃` : "–"}</Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">외부 체감</Text>
          <Text fz={28} fw={800} lh={1.1} c="sky">{p?.outdoor_feels != null ? `${p.outdoor_feels}℃` : "–"}</Text>
        </Box>
      </Group>
      <Divider my="sm" />
      <Group justify="space-between">
        <Text size="sm" c="dimmed">현장 내부 체감</Text>
        <Text fw={700}>{p?.indoor_feels_like != null ? `${p.indoor_feels_like}℃` : "–"}</Text>
      </Group>
      {enclosed && delta != null && (
        <Box mt="sm" p="xs" style={{ background: "var(--mantine-color-red-light)", borderRadius: 8 }}>
          <Group gap={6} wrap="nowrap">
            <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
            <Text size="xs" c="red.7">밀폐형 폭염 — 내부가 외부 대비 <b>+{delta.toFixed(1)}℃</b> 높음</Text>
          </Group>
        </Box>
      )}
      {loc && <Text size="xs" c="dimmed" mt="xs">{loc}</Text>}
    </Paper>
  );
}
