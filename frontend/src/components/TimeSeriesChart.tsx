import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge, Box, Group, Paper, Text, Title } from "@mantine/core";
import type { Kpi, TimeSeries } from "../types";
import { ChartTooltip, dayCount, dayStarts, makeTickFormatter, shortDate } from "./chartkit";

const _WD = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  if (!m) return d || "";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 (${_WD[dt.getDay()]})`;
}

export function TimeSeriesChart({ ts, kpi, date }: { ts: TimeSeries | null; kpi: Kpi | null; date?: string }) {
  const points = ts?.points ?? [];
  const data = points.map((p) => ({ x: p.t, 온도: p.temperature, 체감온도: p.feels_like, 습도: p.humidity }));
  const th = kpi?.thresholds;
  const days = dayCount(points);
  const multi = days > 1;
  const tickFmt = makeTickFormatter(days);
  const dstarts = multi ? dayStarts(points) : [];

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      {/* 측정 일자/기간 — N일이면 기간+라벨로 전환 */}
      {(date || points.length > 0) && (
        <Box bg="kw.0" p="xs" mb="md" style={{ borderRadius: "0.75rem" }}>
          <Group gap="sm" wrap="nowrap">
            <Badge color="kw">{multi ? "측정기간" : "측정일"}</Badge>
            <Text fw={800} c="kw" fz="xl">
              {multi
                ? `${shortDate(points[0].t)} ~ ${shortDate(points[points.length - 1].t)}`
                : fmtDate(date ?? points[0]?.t?.slice(0, 10) ?? "")}
            </Text>
            <Text size="xs" c="dimmed" ml="auto">{multi ? `${days}일간` : "데이터 기준 일자"}</Text>
          </Group>
        </Box>
      )}
      <Group justify="space-between" mb="xs">
        <Title order={3} fz="md" c="#0f172a">시계열 분석 (온·습도 / 체감온도)</Title>
        <Text size="xs" c="dimmed">{ts ? `${ts.interval_minutes}분 평균 다운샘플링` : ""}</Text>
      </Group>
      {data.length === 0 ? (
        <Box h={288} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text c="dimmed">데이터가 없습니다.</Text>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: multi ? 24 : 10, right: 14, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ts-humi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#eef2f7" />
            <XAxis
              dataKey="x"
              tickFormatter={tickFmt}
              minTickGap={multi ? 56 : 40}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis yAxisId="temp" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="℃" domain={["auto", "auto"]} width={44} />
            <YAxis yAxisId="humi" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} width={40} />
            <Tooltip content={<ChartTooltip units={{ 온도: "℃", 체감온도: "℃", 습도: "%" }} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
            {/* 날짜별 기준선 + 라벨(M/D) — 첫 날은 라벨만 */}
            {dstarts.map((d, i) => (
              <ReferenceLine key={d.x} yAxisId="temp" x={d.x}
                stroke={i === 0 ? "transparent" : "#dbe3ec"} strokeDasharray="3 4"
                label={{ value: d.label, position: "top", fontSize: 10, fontWeight: 700, fill: "#475569" }} />
            ))}
            <Area yAxisId="humi" type="monotone" dataKey="습도" stroke="#38bdf8" strokeWidth={1} fill="url(#ts-humi)" dot={false} activeDot={false} />
            <Line yAxisId="temp" type="monotone" dataKey="온도" stroke="#1790cd" dot={false} strokeWidth={1.6} strokeLinecap="round" activeDot={{ r: 4 }} />
            <Line yAxisId="temp" type="monotone" dataKey="체감온도" stroke="#dc2626" dot={false} strokeWidth={2.4} strokeLinecap="round" activeDot={{ r: 5 }} />
            {th && (
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
