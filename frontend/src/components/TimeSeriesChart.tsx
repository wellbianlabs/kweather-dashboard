import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Paper, Box, Group, Badge, Title, Text } from "@mantine/core";
import type { Kpi, TimeSeries } from "../types";

function fmtTime(t: string) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const _WD = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  if (!m) return d || "";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 (${_WD[dt.getDay()]})`;
}

export function TimeSeriesChart({ ts, kpi, date }: { ts: TimeSeries | null; kpi: Kpi | null; date?: string }) {
  const data = (ts?.points || []).map((p) => ({
    time: fmtTime(p.t),
    온도: p.temperature,
    체감온도: p.feels_like,
    습도: p.humidity,
  }));
  const th = kpi?.thresholds;

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      {/* 측정 일자 — 언제 데이터인지 한눈에 */}
      {date && (
        <Box bg="kw.0" p="xs" mb="md" style={{ borderRadius: "0.75rem" }}>
          <Group gap="sm" wrap="nowrap">
            <Badge color="kw">측정일</Badge>
            <Text fw={800} c="kw" fz="xl">{fmtDate(date)}</Text>
            <Text size="xs" c="dimmed" ml="auto">데이터 기준 일자</Text>
          </Group>
        </Box>
      )}
      <Group justify="space-between" mb="xs">
        <Title order={3} fz="md" c="#0f172a">시계열 분석 (온·습도 / 체감온도)</Title>
        <Text size="xs" c="dimmed">
          {ts ? `${ts.interval_minutes}분 평균 다운샘플링` : ""}
        </Text>
      </Group>
      {data.length === 0 ? (
        <Box h={288} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text c="dimmed">데이터가 없습니다.</Text>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis yAxisId="temp" tick={{ fontSize: 11 }} unit="℃"
                   domain={["auto", "auto"]} label={{ value: "온도", angle: -90, position: "insideLeft", fontSize: 11 }} />
            <YAxis yAxisId="humi" orientation="right" tick={{ fontSize: 11 }} unit="%"
                   domain={[0, 100]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area yAxisId="humi" type="monotone" dataKey="습도" fill="#bae6fd" stroke="#38bdf8"
                  fillOpacity={0.35} dot={false} />
            <Line yAxisId="temp" type="monotone" dataKey="온도" stroke="#1790cd" dot={false} strokeWidth={1.5} />
            <Line yAxisId="temp" type="monotone" dataKey="체감온도" stroke="#dc2626" dot={false} strokeWidth={2.2} />
            {th && (
              <>
                <ReferenceLine yAxisId="temp" y={th.caution} stroke="#facc15" strokeDasharray="4 4"
                               label={{ value: "주의 33℃", fontSize: 10, fill: "#a16207", position: "right" }} />
                <ReferenceLine yAxisId="temp" y={th.warning} stroke="#f97316" strokeDasharray="4 4"
                               label={{ value: "경고 35℃", fontSize: 10, fill: "#c2410c", position: "right" }} />
                <ReferenceLine yAxisId="temp" y={th.danger} stroke="#dc2626" strokeDasharray="4 4"
                               label={{ value: "위험 38℃", fontSize: 10, fill: "#b91c1c", position: "right" }} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
