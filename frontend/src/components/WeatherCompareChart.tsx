import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Paper, Box, Group, Title, Text, Alert } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { WeatherCompare } from "../types";

function fmtTime(t: string) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function WeatherCompareChart({ cmp }: { cmp: WeatherCompare | null }) {
  const data = (cmp?.points || []).map((p) => ({
    time: fmtTime(p.t),
    "현장 체감온도": p.indoor_feels_like,
    "야외 체감온도": p.outdoor_feels,
    "야외 기온": p.outdoor_temperature,
    "체감온도 격차": p.delta,
  }));
  const hasOutFeels = data.some((d) => d["야외 체감온도"] != null);

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Group justify="space-between" mb="xs">
        <Title order={3} fz="md" c="#0f172a">
          야외 vs 현장(내부) 체감온도 비교 <Text span c="dimmed" fw={400}>— 기상청 공식 외부 체감온도 매칭</Text>
        </Title>
        <Text size="xs" c="dimmed">데이터 제공: 케이웨더(주)</Text>
      </Group>

      {cmp?.enclosed_alert && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} mb="md">
          <b>밀폐형 폭염 사업장 경고</b> — 현장 체감온도가 야외 체감온도보다 최대 {cmp.max_delta}℃ 높습니다
          (임계 {cmp.enclosed_threshold}℃ 초과). 환기·냉방 대책이 필요합니다.
        </Alert>
      )}

      {data.length === 0 ? (
        <Box h={288} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text c="dimmed">데이터가 없습니다.</Text>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} unit="℃" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="체감온도 격차" fill="#fecaca" barSize={10} />
            <Line type="monotone" dataKey="현장 체감온도" stroke="#dc2626" dot={false} strokeWidth={2.2} />
            {hasOutFeels && <Line type="monotone" dataKey="야외 체감온도" stroke="#1790cd" dot={false} strokeWidth={2.2} />}
            <Line type="monotone" dataKey="야외 기온" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.4} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
