import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Alert, Box, Group, Paper, Text, Title } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { WeatherCompare } from "../types";
import { ChartTooltip, dayCount, dayStarts, makeTickFormatter } from "./chartkit";

export function WeatherCompareChart({ cmp }: { cmp: WeatherCompare | null }) {
  const points = cmp?.points ?? [];
  const data = points.map((p) => ({
    x: p.t,
    "현장 체감온도": p.indoor_feels_like,
    "기상청 공식 체감온도": p.outdoor_feels,
    "기상청 기온": p.outdoor_temperature,
    "체감온도 격차": p.delta,
  }));
  const hasOutFeels = data.some((d) => d["기상청 공식 체감온도"] != null);
  const days = dayCount(points);
  const multi = days > 1;
  const tickFmt = makeTickFormatter(days);
  const dstarts = multi ? dayStarts(points) : [];

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Group justify="space-between" mb="xs">
        <Title order={3} fz="md" c="#0f172a">
          현장(내부) vs 기상청 공식 체감온도 비교 <Text span c="dimmed" fw={400}>— 측정 당시 시각 매칭</Text>
        </Title>
        <Text size="xs" c="dimmed">데이터 제공: 케이웨더(주)</Text>
      </Group>

      {cmp?.enclosed_alert && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} mb="md">
          <b>밀폐형 폭염 사업장 경고</b> — 현장 체감온도가 기상청 공식 체감온도보다 최대 {cmp.max_delta}℃ 높습니다
          (임계 {cmp.enclosed_threshold}℃ 초과). 환기·냉방 대책이 필요합니다.
        </Alert>
      )}

      {data.length === 0 ? (
        <Box h={288} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text c="dimmed">데이터가 없습니다.</Text>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: multi ? 24 : 10, right: 14, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cmp-delta" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#fecaca" stopOpacity={0.25} />
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
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="℃" width={44} />
            <Tooltip content={<ChartTooltip units={{ "현장 체감온도": "℃", "기상청 공식 체감온도": "℃", "기상청 기온": "℃", "체감온도 격차": "℃" }} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
            {dstarts.map((d, i) => (
              <ReferenceLine key={d.x} x={d.x}
                stroke={i === 0 ? "transparent" : "#dbe3ec"} strokeDasharray="3 4"
                label={{ value: d.label, position: "top", fontSize: 10, fontWeight: 700, fill: "#475569" }} />
            ))}
            <Bar dataKey="체감온도 격차" fill="url(#cmp-delta)" barSize={multi ? 4 : 10} radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="현장 체감온도" stroke="#dc2626" dot={false} strokeWidth={2.4} strokeLinecap="round" activeDot={{ r: 5 }} />
            {hasOutFeels && <Line type="monotone" dataKey="기상청 공식 체감온도" stroke="#1790cd" dot={false} strokeWidth={2.2} strokeLinecap="round" activeDot={{ r: 4 }} />}
            <Line type="monotone" dataKey="기상청 기온" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.4} activeDot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
