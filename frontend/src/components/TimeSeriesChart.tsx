import { useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge, Box, Chip, Group, Paper, Text, Title } from "@mantine/core";
import type { Kpi, TimeSeries, WeatherCompare } from "../types";
import { ChartTooltip, dayCount, dayStarts, makeTickFormatter, shortDate } from "./chartkit";

const _WD = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  if (!m) return d || "";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 (${_WD[dt.getDay()]})`;
}

// 분석 옵션 시리즈 — 측정기(실선)·기상청(점선) × 체감/온도/습도
type SeriesDef = { key: string; label: string; axis: "temp" | "humi"; color: string; dash: boolean; w: number; area?: boolean };
const SERIES: SeriesDef[] = [
  { key: "측정_체감", label: "측정기 체감", axis: "temp", color: "#dc2626", dash: false, w: 2.4 },
  { key: "측정_온도", label: "측정기 온도", axis: "temp", color: "#1790cd", dash: false, w: 1.8 },
  { key: "측정_습도", label: "측정기 습도", axis: "humi", color: "#38bdf8", dash: false, w: 1.4, area: true },
  { key: "기상_체감", label: "기상청 체감", axis: "temp", color: "#f97316", dash: true, w: 2 },
  { key: "기상_온도", label: "기상청 온도", axis: "temp", color: "#0ea5e9", dash: true, w: 1.6 },
  { key: "기상_습도", label: "기상청 습도", axis: "humi", color: "#7dd3fc", dash: true, w: 1.4 },
];
// 기본은 핵심 체감온도 2계열만(측정기 실선 + 기상청 점선) — 단일일 곡선이 명확하게.
// 온도·습도(습도는 면적·우측 %축)는 계열 칩으로 켜서 볼 수 있음(겹쳐 복잡해 보이는 것 방지).
const DEFAULT_ON = ["측정_체감", "기상_체감"];
const UNITS = Object.fromEntries(SERIES.map((s) => [s.key, s.axis === "humi" ? "%" : "℃"]));

export function TimeSeriesChart({ ts, cmp, kpi, date }: {
  ts: TimeSeries | null; cmp?: WeatherCompare | null; kpi: Kpi | null; date?: string;
}) {
  const [active, setActive] = useState<string[]>(DEFAULT_ON);

  // 병합: 측정일자(t) 기준 측정기(ts) + 기상청(cmp).
  // date 가 지정되면(대시보드 단일일) 해당 날짜 포인트만 사용 — 시계열/기상청 응답이
  // 엇갈려 다른 날짜가 섞여 '여러 날'로 그려지는 현상을 방지(방어적 필터).
  const inDay = (t: string) => !date || t.slice(0, 10) === date;
  const byT = new Map<string, Record<string, unknown>>();
  (ts?.points ?? []).forEach((p) => { if (inDay(p.t)) byT.set(p.t, { x: p.t, 측정_온도: p.temperature, 측정_체감: p.feels_like, 측정_습도: p.humidity }); });
  (cmp?.points ?? []).forEach((p) => {
    if (!inDay(p.t)) return;
    const e = byT.get(p.t) ?? { x: p.t };
    e.기상_온도 = p.outdoor_temperature; e.기상_체감 = p.outdoor_feels; e.기상_습도 = p.outdoor_humidity;
    byT.set(p.t, e);
  });
  const data = [...byT.values()].sort((a, b) => (String(a.x) < String(b.x) ? -1 : 1));

  const tpoints = data.map((d) => ({ t: String(d.x) }));
  const days = dayCount(tpoints);
  const multi = days > 1;
  const tickFmt = makeTickFormatter(days);
  const dstarts = multi ? dayStarts(tpoints) : [];
  const hasCmp = (cmp?.points?.length ?? 0) > 0;
  const th = kpi?.thresholds;
  const showTemp = SERIES.some((s) => s.axis === "temp" && active.includes(s.key));

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      {(date || data.length > 0) && (
        <Box bg="kw.0" p="xs" mb="md" style={{ borderRadius: "0.75rem" }}>
          <Group gap="sm" wrap="nowrap">
            <Badge color="kw">{multi ? "측정기간" : "측정일"}</Badge>
            <Text fw={800} c="kw" fz="xl">
              {multi
                ? `${shortDate(String(data[0].x))} ~ ${shortDate(String(data[data.length - 1].x))}`
                : fmtDate(date ?? String(data[0]?.x ?? "").slice(0, 10))}
            </Text>
            <Text size="xs" c="dimmed" ml="auto">{multi ? `${days}일간` : "데이터 기준 일자"}</Text>
          </Group>
        </Box>
      )}
      <Group justify="space-between" mb="xs">
        <Title order={3} fz="md" c="#0f172a">데이터 분석 (측정기 · 기상청)</Title>
        <Text size="xs" c="dimmed">{ts ? `${ts.interval_minutes}분 평균` : ""}{!hasCmp ? " · 기상청 자료 없음" : ""}</Text>
      </Group>

      {/* 분석 옵션 — 표시할 계열 토글 */}
      <Chip.Group multiple value={active} onChange={setActive}>
        <Group gap={6} mb="sm">
          {SERIES.map((s) => (
            <Chip key={s.key} value={s.key} size="xs" radius="sm"
              disabled={s.key.startsWith("기상") && !hasCmp}>
              {s.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      {data.length === 0 ? (
        <Box h={288} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text c="dimmed">데이터가 없습니다.</Text>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: multi ? 24 : 10, right: 14, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ts-humi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="x" tickFormatter={tickFmt} minTickGap={multi ? 56 : 40}
              tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis yAxisId="temp" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="℃" domain={["auto", "auto"]} width={44} />
            <YAxis yAxisId="humi" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} width={40} />
            <Tooltip content={<ChartTooltip units={UNITS} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
            {dstarts.map((d, i) => (
              <ReferenceLine key={d.x} yAxisId="temp" x={d.x}
                stroke={i === 0 ? "transparent" : "#dbe3ec"} strokeDasharray="3 4"
                label={{ value: d.label, position: "top", fontSize: 10, fontWeight: 700, fill: "#475569" }} />
            ))}
            {SERIES.filter((s) => active.includes(s.key)).map((s) => (
              s.area ? (
                <Area key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.label}
                  stroke={s.color} strokeWidth={s.w} fill="url(#ts-humi)" dot={false} activeDot={false} connectNulls />
              ) : (
                <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.label}
                  stroke={s.color} strokeWidth={s.w} dot={false} strokeLinecap="round"
                  strokeDasharray={s.dash ? "5 4" : undefined} activeDot={{ r: 4 }} connectNulls />
              )
            ))}
            {th && showTemp && (
              <>
                <ReferenceLine yAxisId="temp" y={th.caution} stroke="#facc15" strokeDasharray="4 4" label={{ value: "주의 33℃", fontSize: 10, fill: "#a16207", position: "right" }} />
                <ReferenceLine yAxisId="temp" y={th.warning} stroke="#f97316" strokeDasharray="4 4" label={{ value: "경고 35℃", fontSize: 10, fill: "#c2410c", position: "right" }} />
                <ReferenceLine yAxisId="temp" y={th.danger} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "위험 38℃", fontSize: 10, fill: "#b91c1c", position: "right" }} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
