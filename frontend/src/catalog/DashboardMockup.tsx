// 대시보드 목업 프로토타입 (독립 URL /dashboard-mockup.html) — 협의용 1차안.
// 목업 기준: KPI 3종 + 좌(일일 리포트 요약·데이터 분석 차트) + 우(주간 예보·관심 지수 게이지).
// 전자상거래 템플릿 잔재($매출·Customers·this/last $)는 제거, 미정 영역은 빈 그리드로 표시.
import type { ReactNode } from "react";
import {
  ActionIcon, Avatar, Badge, Box, Button, Card, Grid, Group, Paper, Stack, Text, ThemeIcon, Tooltip,
} from "@mantine/core";
import {
  Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import {
  IconBell, IconBox, IconChartBar, IconChevronDown, IconCompass,
  IconDeviceFloppy, IconDownload, IconInbox, IconLayoutGrid, IconPercentage, IconPhoto,
  IconSun, IconUsers, IconArrowUpRight, IconCalendar,
} from "@tabler/icons-react";

const MAXW = 1200; // inner 최대폭 — 와이드 화면에서 늘어짐 방지

/* ───────── heat scale (시스템 일치) ───────── */
const LV = {
  safe: { label: "안전", color: "#16a34a" },
  attention: { label: "관심", color: "#84cc16" },
  caution: { label: "주의", color: "#eab308" },
  warning: { label: "경고", color: "#f97316" },
  danger: { label: "위험", color: "#dc2626" },
} as const;
type LvKey = keyof typeof LV;
function classify(f: number): LvKey {
  if (f >= 38) return "danger";
  if (f >= 35) return "warning";
  if (f >= 33) return "caution";
  if (f >= 31) return "attention";
  return "safe";
}

/* ───────── mock 데이터(임의값 — 협의 후 실배선) ───────── */
const KPIS = [
  { label: "일 최고 체감온도", value: "38.0", unit: "℃", level: "danger" as LvKey, sub: "14시 37분 발생" },
  { label: "일 최고 온도", value: "35.0", unit: "℃", level: "danger" as LvKey, sub: "14시 25분 발생" },
  { label: "체감온도 주의단계 지속시간", value: "15시간 28분", unit: "", level: "danger" as LvKey, sub: "근무시간의 60%" },
];

const FORECAST = [
  { d: "06.01", f: 33.2 }, { d: "06.02", f: 34.1 }, { d: "06.03", f: 38.8 },
  { d: "06.04", f: 36.4 }, { d: "06.05", f: 32.0 }, { d: "06.06", f: 34.7 }, { d: "06.07", f: 35.9 },
].map((x) => ({ ...x, level: classify(x.f) }));

const HOURLY = Array.from({ length: 24 }, (_, h) => {
  const f = +(26 + 12 * Math.max(0, Math.cos(((h - 14) / 24) * 2 * Math.PI))).toFixed(1);
  return { t: `${String(h).padStart(2, "0")}시`, feels: f, temp: +(f - 2.4).toFixed(1) };
});

const GAUGE_TEMP = 32; // 현재 보고 있는 디바이스 설치장소 실시간 체감(℃) — 실배선 시 device 실시간값

/* ───────── 반원 4단계 게이지 (정해진 단계 색·임계 준수) ─────────
   4단계: 관심(31~33)·주의(33~35)·경고(35~38)·위험(38℃↑). 값은 현재 디바이스 실시간 온도.
   전 단계를 단계색 눈금으로 표시하고, 현재 단계만 강조 + 중앙에 현재 단계/실시간값. */
const GAUGE_ZONES: { key: LvKey; lo: number; hi: number }[] = [
  { key: "attention", lo: 31, hi: 33 },
  { key: "caution", lo: 33, hi: 35 },
  { key: "warning", lo: 35, hi: 38 },
  { key: "danger", lo: 38, hi: 42 },
];
function HeatGauge({ temp }: { temp: number }) {
  const key = classify(temp);
  const lvl = LV[key];
  const N = 52;
  const cx = 130, cy = 122, rIn = 74, rOut = 106;
  const zoneOf = (t: number) => Math.min(3, Math.floor(t * 4)); // 동일 각도 4구간
  const ticks = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    const ang = Math.PI - t * Math.PI; // 180°(좌)→0°(우)
    const x1 = cx + rIn * Math.cos(ang), y1 = cy - rIn * Math.sin(ang);
    const x2 = cx + rOut * Math.cos(ang), y2 = cy - rOut * Math.sin(ang);
    const zKey = GAUGE_ZONES[zoneOf(Math.min(0.999, t))].key;
    return { x1, y1, x2, y2, color: LV[zKey].color, active: zKey === key };
  });
  // 임계 라벨(31/33/35/38) — 구간 경계
  const bounds = [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
    const ang = Math.PI - t * Math.PI;
    const r = rOut + 11;
    return { x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang), v: [31, 33, 35, 38, 42][i] };
  });
  return (
    <Box style={{ width: "100%" }}>
      <svg viewBox="0 0 260 150" style={{ width: "100%", display: "block" }}>
        {ticks.map((tk, i) => (
          <line key={i} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
            stroke={tk.color} strokeWidth={4} strokeLinecap="round" opacity={tk.active ? 1 : 0.3} />
        ))}
        {bounds.map((b, i) => (
          <text key={i} x={b.x} y={b.y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 8.5, fill: "#cbd5e1" }}>{b.v}</text>
        ))}
        <text x={cx} y={cy - 20} textAnchor="middle" style={{ fontSize: 30, fontWeight: 800, fill: lvl.color }}>{lvl.label}</text>
        <text x={cx} y={cy + 2} textAnchor="middle" style={{ fontSize: 12, fill: "#64748b" }}>실시간 {temp}℃</text>
      </svg>
    </Box>
  );
}

/* ───────── KPI 카드 ───────── */
function KpiCard({ label, value, unit, level, sub }:
  { label: string; value: string; unit: string; level: LvKey; sub: string }) {
  const c = LV[level].color;
  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={600} c="dark.5" fz="sm">{label}</Text>
        <Badge radius="sm" styles={{ root: { background: c, color: "#fff" } }}>{LV[level].label}</Badge>
      </Group>
      <Group align="baseline" gap={4} mt="lg">
        <Text fw={800} fz={34} lh={1} style={{ color: c, letterSpacing: "-0.02em" }}>{value}</Text>
        {unit && <Text fw={700} fz="lg" c="dimmed">{unit}</Text>}
      </Group>
      <Text fz="xs" c="dimmed" mt={8}>{sub}</Text>
    </Paper>
  );
}

/* ───────── 카드 헤더 ───────── */
function CardHead({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
      <Box>
        <Text fw={700} fz="sm">{title}</Text>
        {sub && <Text fz={10} c="dimmed" mt={2}>{sub}</Text>}
      </Box>
      {right}
    </Group>
  );
}

/* ───────── 좌측 아이콘 레일(chrome — 시각 정합용) ───────── */
function Rail() {
  const items: { icon: typeof IconBox; active?: boolean; badge?: number }[] = [
    { icon: IconCompass, active: true }, { icon: IconInbox, badge: 46 }, { icon: IconBox },
    { icon: IconUsers }, { icon: IconPhoto }, { icon: IconDeviceFloppy },
  ];
  return (
    <Stack gap={6} align="center" py="md" px={8}
      style={{ width: 60, borderRight: "1px solid var(--mantine-color-gray-2)", background: "#fff" }}>
      <ThemeIcon variant="subtle" color="gray" size="lg" radius="md"><IconLayoutGrid size={18} /></ThemeIcon>
      <Box h={8} />
      {items.map((it, i) => (
        <Box key={i} style={{ position: "relative" }}>
          <ActionIcon variant={it.active ? "light" : "subtle"} color={it.active ? "kw" : "gray"} size="lg" radius="md">
            <it.icon size={19} />
          </ActionIcon>
          {it.badge && (
            <Badge size="xs" circle color="teal" style={{ position: "absolute", top: -2, right: -4 }}>{it.badge}</Badge>
          )}
        </Box>
      ))}
      <Box style={{ flex: 1 }} />
      <ActionIcon variant="subtle" color="gray" size="lg" radius="md"><IconChartBar size={19} /></ActionIcon>
      <ActionIcon variant="subtle" color="gray" size="lg" radius="md"><IconPercentage size={19} /></ActionIcon>
    </Stack>
  );
}

/* ───────── 메인 ───────── */
export function DashboardMockup() {
  return (
    <Box style={{ display: "flex", minHeight: "100vh", background: "#f1f3f5" }}>
      <Rail />
      <Box style={{ flex: 1, minWidth: 0 }}>
        {/* 상단 바 (full-width 배경, inner는 1200 정렬) */}
        <Box style={{ background: "#fff", borderBottom: "1px solid var(--mantine-color-gray-2)", position: "sticky", top: 0, zIndex: 5 }}>
          <Group justify="space-between" wrap="nowrap" px="lg" py="sm" style={{ maxWidth: MAXW, margin: "0 auto" }}>
            <Group gap="sm" wrap="nowrap">
              <Button variant="default" size="xs" radius="md" leftSection={<IconCalendar size={14} />}>2026.06.01 – 06.16</Button>
              <Button variant="default" size="xs" radius="md" rightSection={<IconChevronDown size={14} />}>최근 30일</Button>
              <Tooltip label="후순위(협의)"><Button variant="default" size="xs" radius="md" leftSection={<IconLayoutGrid size={14} />}>위젯 추가</Button></Tooltip>
              <Button color="kw" size="xs" radius="md" leftSection={<IconDownload size={14} />}>내보내기</Button>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon variant="default" radius="xl" size="lg"><IconSun size={17} /></ActionIcon>
              <ActionIcon variant="default" radius="xl" size="lg"><IconBell size={17} /></ActionIcon>
              <Avatar radius="xl" size="md" color="kw" variant="filled">KW</Avatar>
            </Group>
          </Group>
        </Box>

        {/* inner — 최대폭 1200, 중앙 정렬, Mantine Grid */}
        <Box px="lg" py="lg" style={{ maxWidth: MAXW, margin: "0 auto" }}>
          <Grid gap="md">
            {/* KPI 3종 — md 이상 4/4/4 (우측 카드가 우 칼럼 위에 정렬) */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}><KpiCard {...KPIS[0]} /></Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}><KpiCard {...KPIS[1]} /></Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}><KpiCard {...KPIS[2]} /></Grid.Col>

            {/* 좌 칼럼 (8) */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="md">
                {/* 일일 리포트 요약 (← 매출 잔재 교체) */}
                <Card radius="lg" withBorder shadow="xs" p="lg">
                  <CardHead
                    title="일일 리포트 요약"
                    sub="DEMO-A001 · 2026-06-16"
                    right={<Button size="xs" variant="light" color="kw" rightSection={<IconArrowUpRight size={14} />}>상세 보고서</Button>}
                  />
                  <Group align="flex-end" gap="xl" wrap="wrap">
                    <Box>
                      <Text fz="xs" c="dimmed">최고 체감온도</Text>
                      <Group align="baseline" gap={4}>
                        <Text fw={800} fz={30} lh={1} c={LV.danger.color}>38.0</Text><Text fw={700} c="dimmed">℃</Text>
                        <Badge ml={6} radius="sm" styles={{ root: { background: LV.danger.color, color: "#fff" } }}>위험</Badge>
                      </Group>
                    </Box>
                    <Box>
                      <Text fz="xs" c="dimmed">위험단계 노출(38℃↑)</Text>
                      <Text fw={800} fz={22} c={LV.danger.color} mt={2}>40분</Text>
                    </Box>
                    <Box>
                      <Text fz="xs" c="dimmed">법정 휴식 의무</Text>
                      <Text fw={800} fz={22} mt={2}>1회 · 20분</Text>
                    </Box>
                    <Box style={{ flex: 1, minWidth: 160, height: 64 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={HOURLY} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#dc2626" stopOpacity={0.28} />
                              <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="feels" stroke="#dc2626" strokeWidth={2} fill="url(#sp)" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  </Group>
                </Card>

                {/* 데이터 분석 차트 (TimeSeriesChart 연결 예정) */}
                <Card radius="lg" withBorder shadow="xs" p="lg">
                  <CardHead title="데이터 분석"
                    sub="측정기 체감/온도/습도 + 기상청 (6계열 토글) — 운영 TimeSeriesChart 연결 예정"
                    right={<Badge variant="light" color="gray" size="sm">미리보기</Badge>} />
                  <Box style={{ height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={HOURLY} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="af" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="at" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1790cd" stopOpacity={0.14} />
                            <stop offset="100%" stopColor="#1790cd" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={2} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                        <YAxis unit="℃" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={42} />
                        <Area type="monotone" dataKey="feels" name="측정 체감" stroke="#dc2626" strokeWidth={2.2} fill="url(#af)" isAnimationActive={false} />
                        <Area type="monotone" dataKey="temp" name="측정 온도" stroke="#1790cd" strokeWidth={2.2} fill="url(#at)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>
              </Stack>
            </Grid.Col>

            {/* 우 칼럼 (4) */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                {/* 케이웨더 주간 예보 */}
                <Card radius="lg" withBorder shadow="xs" p="lg">
                  <CardHead title="케이웨더 주간 예보" sub="설치위치 종속 권역 · 일별 최고 체감"
                    right={<Text fz={10} c="dimmed">단계색</Text>} />
                  <Box style={{ height: 150 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={FORECAST} margin={{ top: 18, right: 4, left: -22, bottom: 0 }}>
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis hide domain={[28, 42]} />
                        <Bar dataKey="f" radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={false}
                          label={{ position: "top", fontSize: 9, fill: "#64748b" }}>
                          {FORECAST.map((r, i) => <Cell key={i} fill={LV[r.level].color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>

                {/* 폭염 단계 관심 지수 게이지 (4단계 준수 · 현재 디바이스 실시간) */}
                <Card radius="lg" withBorder shadow="xs" p="lg">
                  <CardHead title="폭염 단계 관심 지수"
                    sub="DEMO-A001 · 제2공장 정련로 앞 — 현재 디바이스 실시간"
                    right={<Group gap={5} wrap="nowrap" align="center">
                      <Box style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a" }} />
                      <Text fz={10} c="dimmed">실시간</Text>
                    </Group>} />
                  <HeatGauge temp={GAUGE_TEMP} />
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
