// 대시보드 페이지 — 협업팀 목업 정합본(실데이터 배선).
// 구성: KPI 3종 + 좌(일일 리포트 요약 · 데이터 분석[TimeSeriesChart]) + 우(주간 예보 · 폭염 관심 지수 게이지).
// 위험지도·외부날씨비교·사업장표는 목업 기준으로 제외(컴포넌트는 보존).
import type { ReactNode } from "react";
import { Badge, Box, Button, Card, Grid, Group, Stack, Text } from "@mantine/core";
import {
  Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { IconArrowUpRight } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import type { TimeSeries } from "../../types";
import { useDashboard } from "../DashboardProvider";

/* ── heat scale (시스템 색) ── */
const LV = {
  safe: { label: "안전", color: "#16a34a" },
  attention: { label: "관심", color: "#84cc16" },
  caution: { label: "주의", color: "#facc15" },
  warning: { label: "경고", color: "#f97316" },
  danger: { label: "위험", color: "#dc2626" },
} as const;
type LvKey = keyof typeof LV;
type Stage = { label: string; color: string };

function classifyBy(v: number | null | undefined, th: Record<string, number>): LvKey {
  if (v == null) return "safe";
  if (v >= (th.danger ?? 38)) return "danger";
  if (v >= (th.warning ?? 35)) return "warning";
  if (v >= (th.caution ?? 33)) return "caution";
  if (v >= (th.attention ?? 31)) return "attention";
  return "safe";
}
function fmtMin(min?: number | null): string {
  if (!min || min <= 0) return "0분";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}
function lastFeels(ts: TimeSeries | null): { v: number; t: string } | null {
  const pts = ts?.points ?? [];
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].feels_like != null) return { v: pts[i].feels_like as number, t: pts[i].t };
  }
  return null;
}

/* ── KPI 카드 ── */
function KpiCard({ label, value, unit, stage, sub }:
  { label: string; value: string; unit?: string; stage: Stage; sub?: string }) {
  return (
    <Card radius="lg" p="lg" withBorder shadow="xs" h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={600} c="dark.5" fz="sm">{label}</Text>
        <Badge radius="sm" styles={{ root: { background: stage.color, color: "#fff" } }}>{stage.label}</Badge>
      </Group>
      <Group align="baseline" gap={4} mt="lg">
        <Text fw={800} fz={34} lh={1} style={{ color: stage.color, letterSpacing: "-0.02em" }}>{value}</Text>
        {unit && <Text fw={700} fz="lg" c="dimmed">{unit}</Text>}
      </Group>
      <Text fz="xs" c="dimmed" mt={8} style={{ minHeight: 16 }}>{sub ?? ""}</Text>
    </Card>
  );
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
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

/* ── 반원 4단계 게이지 (관심/주의/경고/위험 색·임계 준수) ── */
const ZONES: LvKey[] = ["attention", "caution", "warning", "danger"];
function HeatGauge({ temp, th }: { temp: number | null; th: Record<string, number> }) {
  const key = classifyBy(temp, th);
  const lvl = LV[key];
  const N = 52, cx = 130, cy = 122, rIn = 74, rOut = 106;
  const ticks = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    const ang = Math.PI - t * Math.PI;
    const x1 = cx + rIn * Math.cos(ang), y1 = cy - rIn * Math.sin(ang);
    const x2 = cx + rOut * Math.cos(ang), y2 = cy - rOut * Math.sin(ang);
    const zKey = ZONES[Math.min(3, Math.floor(Math.min(0.999, t) * 4))];
    return { x1, y1, x2, y2, color: LV[zKey].color, active: zKey === key };
  });
  const bounds = [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
    const ang = Math.PI - t * Math.PI, r = rOut + 11;
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
        <text x={cx} y={cy + 2} textAnchor="middle" style={{ fontSize: 12, fill: "#64748b" }}>
          {temp != null ? `최고 ${temp.toFixed(1)}℃` : "측정 없음"}
        </text>
      </svg>
    </Box>
  );
}

/* 최근 7일 체감온도 분석 — 일 최고(단계색 막대) + 일 평균(선) + 위험단계 임계선. */
type WeeklyRow = { date: string; max_feels: number | null; avg_feels: number | null; max_temp: number | null };

function WeeklyTooltip({ active, payload, th }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0]?.payload as { d: string; max: number | null; avg: number | null; temp: number | null };
  if (!r) return null;
  const lv = r.max != null ? LV[classifyBy(r.max, th)] : null;
  return (
    <Box style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", boxShadow: "0 4px 12px rgba(15,23,42,0.12)" }}>
      <Text fz={11} fw={700} c="dark.6" mb={4}>{r.d}</Text>
      <Group gap={6} mb={2} wrap="nowrap">
        <Box w={8} h={8} style={{ borderRadius: 2, background: lv?.color ?? "#cbd5e1" }} />
        <Text fz={11} c="dimmed">최고 체감</Text>
        <Text fz={11} fw={700} ml="auto">{r.max != null ? `${r.max.toFixed(1)}℃` : "-"}{lv ? ` (${lv.label})` : ""}</Text>
      </Group>
      <Group gap={6} mb={2} wrap="nowrap">
        <Box w={8} h={8} style={{ borderRadius: 8, background: "#1e293b" }} />
        <Text fz={11} c="dimmed">평균 체감</Text>
        <Text fz={11} fw={700} ml="auto">{r.avg != null ? `${r.avg.toFixed(1)}℃` : "-"}</Text>
      </Group>
      <Group gap={6} wrap="nowrap">
        <Box w={8} h={8} />
        <Text fz={11} c="dimmed">최고 기온</Text>
        <Text fz={11} fw={700} ml="auto">{r.temp != null ? `${r.temp.toFixed(1)}℃` : "-"}</Text>
      </Group>
    </Box>
  );
}

function ForecastBar({ weekly, th }: { weekly: WeeklyRow[]; th: Record<string, number> }) {
  const rows = weekly.map((w) => ({
    d: w.date.slice(5),
    max: w.max_feels,
    avg: w.avg_feels,
    temp: w.max_temp,
    color: w.max_feels != null ? LV[classifyBy(w.max_feels, th)].color : "#e5e7eb",
  }));
  const vals = rows.flatMap((r) => [r.max, r.avg]).filter((v): v is number => v != null);
  if (!rows.some((r) => r.max != null)) {
    return <Box style={{ height: 188, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Text size="sm" c="dimmed">측정 데이터 없음</Text></Box>;
  }
  const ymin = Math.max(0, Math.floor((Math.min(...vals) - 2) / 2) * 2);
  const ymax = Math.ceil((Math.max(...vals) + 3) / 2) * 2;
  // 도메인 안에 들어오는 임계선만 표시(주의/경고/위험)
  const marks = ([["caution", "주의"], ["warning", "경고"], ["danger", "위험"]] as const)
    .map(([k, label]) => ({ v: th[k] ?? ({ caution: 33, warning: 35, danger: 38 } as any)[k], label, color: LV[k].color }))
    .filter((m) => m.v >= ymin && m.v <= ymax);
  return (
    <Box>
      <Box style={{ height: 188 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 22, right: 30, left: -10, bottom: 2 }} barCategoryGap="26%">
            <CartesianGrid vertical={false} stroke="#eef2f6" />
            <XAxis dataKey="d" interval={0} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[ymin, ymax]} width={34} tick={{ fontSize: 9.5, fill: "#94a3b8" }}
              axisLine={false} tickLine={false} tickFormatter={(v) => `${v}°`} />
            <Tooltip content={<WeeklyTooltip th={th} />} cursor={{ fill: "rgba(148,163,184,0.10)" }} />
            {marks.map((m) => (
              <ReferenceLine key={m.label} y={m.v} stroke={m.color} strokeDasharray="4 3" strokeWidth={1}
                label={{ value: `${m.label} ${m.v}°`, position: "right", fontSize: 8.5, fill: m.color }} />
            ))}
            <Bar dataKey="max" radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false}>
              {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
              <LabelList dataKey="max" position="top" fontSize={10} fontWeight={700} fill="#334155"
                formatter={(v: any) => (typeof v === "number" ? v.toFixed(1) : "")} />
            </Bar>
            <Line type="monotone" dataKey="avg" stroke="#1e293b" strokeWidth={1.6} isAnimationActive={false}
              dot={{ r: 2.2, fill: "#1e293b", strokeWidth: 0 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
      {/* 범례 */}
      <Group gap={14} justify="center" mt={6} wrap="wrap">
        <Group gap={5} wrap="nowrap"><Box w={11} h={11} style={{ borderRadius: 3, background: "linear-gradient(180deg,#f97316,#dc2626)" }} /><Text fz={10} c="dimmed">일 최고 체감</Text></Group>
        <Group gap={5} wrap="nowrap"><Box w={14} h={2} style={{ borderRadius: 2, background: "#1e293b" }} /><Text fz={10} c="dimmed">일 평균 체감</Text></Group>
        <Group gap={5} wrap="nowrap"><Box w={14} h={0} style={{ borderTop: "1.5px dashed #dc2626" }} /><Text fz={10} c="dimmed">위험단계 임계</Text></Group>
      </Group>
    </Box>
  );
}

export function DashboardPage() {
  const { kpi, ts, cmp, date, selected, deviceSn, weekly } = useDashboard();
  const navigate = useNavigate();
  const th = kpi?.thresholds ?? {};
  const interval = ts?.interval_minutes ?? 10;

  // 파생값(실데이터)
  const cautionMin = (ts?.points ?? []).filter((p) => p.feels_like != null && (p.feels_like as number) >= (th.caution ?? 33)).length * interval;
  const spark = (ts?.points ?? []).map((p) => ({ t: p.t, feels: p.feels_like }));
  const devLabel = selected ? `${selected.device_sn}${selected.location_name ? ` · ${selected.location_name}` : ""}` : (deviceSn ?? "전체 사업장");

  const feelStage: Stage = kpi?.current_level ?? LV.safe;
  const tempStage: Stage = LV[classifyBy(kpi?.max_temperature, th)];
  const cautionStage: Stage = cautionMin > 0 ? LV.caution : LV.safe;

  return (
    <Grid gap="md">
      {/* KPI 3종 */}
      <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
        <KpiCard label="일 최고 체감온도" value={kpi?.max_feels_like != null ? kpi.max_feels_like.toFixed(1) : "–"} unit="℃"
          stage={feelStage} sub={kpi?.max_feels_like_time ? `${kpi.max_feels_like_time} 발생` : ""} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
        <KpiCard label="일 최고 온도" value={kpi?.max_temperature != null ? kpi.max_temperature.toFixed(1) : "–"} unit="℃"
          stage={tempStage} sub={kpi?.max_temperature_time ? `${kpi.max_temperature_time} 발생` : ""} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
        <KpiCard label="체감 주의단계(33℃↑) 지속" value={fmtMin(cautionMin)}
          stage={cautionStage} sub="분석일 측정 누적" />
      </Grid.Col>

      {/* 좌 칼럼(8) */}
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack gap="md">
          {/* 일일 리포트 요약 */}
          <Card radius="lg" withBorder shadow="xs" p="lg">
            <CardHead title="일일 리포트 요약" sub={`${devLabel} · ${date}`}
              right={<Button size="xs" variant="light" color="kw" rightSection={<IconArrowUpRight size={14} />}
                onClick={() => navigate("/report")}>상세 보고서</Button>} />
            <Group align="flex-end" gap="xl" wrap="wrap">
              <Box>
                <Text fz="xs" c="dimmed">최고 체감온도</Text>
                <Group align="baseline" gap={4}>
                  <Text fw={800} fz={30} lh={1} c={feelStage.color}>{kpi?.max_feels_like != null ? kpi.max_feels_like.toFixed(1) : "–"}</Text>
                  <Text fw={700} c="dimmed">℃</Text>
                  <Badge ml={6} radius="sm" styles={{ root: { background: feelStage.color, color: "#fff" } }}>{feelStage.label}</Badge>
                </Group>
              </Box>
              <Box>
                <Text fz="xs" c="dimmed">위험단계 노출(38℃↑)</Text>
                <Text fw={800} fz={22} c={LV.danger.color} mt={2}>{fmtMin(kpi?.danger_minutes)}</Text>
              </Box>
              <Box>
                <Text fz="xs" c="dimmed">평균 습도</Text>
                <Text fw={800} fz={22} mt={2}>{kpi?.avg_humidity != null ? `${kpi.avg_humidity}%` : "–"}</Text>
              </Box>
              <Box style={{ flex: 1, minWidth: 160, height: 64 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dsp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={feelStage.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={feelStage.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="feels" stroke={feelStage.color} strokeWidth={2} fill="url(#dsp)" isAnimationActive={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Group>
          </Card>

          {/* 데이터 분석 — 운영 TimeSeriesChart */}
          <TimeSeriesChart ts={ts} cmp={cmp} kpi={kpi} date={date} />
        </Stack>
      </Grid.Col>

      {/* 우 칼럼(4) */}
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Stack gap="md">
          {/* 최근 7일 일 최고 체감(실측) */}
          <Card radius="lg" withBorder shadow="xs" p="lg">
            <CardHead title="최근 7일 체감온도 분석" sub={`${selected?.device_sn ?? deviceSn ?? "측정기"} · 일 최고·평균 체감(실측)`}
              right={<Text fz={10} c="dimmed">℃</Text>} />
            <ForecastBar weekly={weekly} th={th} />
          </Card>

          {/* 폭염 위험단계 게이지 — 분석일 '최고 체감' 기준(과거 기록 분석, 실시간 아님) */}
          <Card radius="lg" withBorder shadow="xs" p="lg">
            <CardHead title="폭염 위험단계"
              sub={`${devLabel} · 분석일 ${date} 최고 체감 기준`}
              right={<Text fz={10} c="dimmed">분석일 최고</Text>} />
            <HeatGauge temp={kpi?.max_feels_like ?? null} th={th} />
          </Card>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
