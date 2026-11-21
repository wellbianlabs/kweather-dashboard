// 차트 공용 키트 — N일 범위 일자 라벨 + 최신 그래픽(커스텀 툴팁).
import { Box, Group, Paper, Text } from "@mantine/core";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

/** 데이터가 며칠에 걸쳐 있는지(고유 날짜 수). */
export function dayCount(points: { t: string }[]): number {
  return new Set(points.map((p) => p.t.slice(0, 10))).size;
}

/** 날짜가 바뀌는 지점(자정 경계)의 x값 — 다일 구분선용. */
export function dayBoundaries(points: { t: string }[]): string[] {
  const out: string[] = [];
  let prev = "";
  for (const p of points) {
    const day = p.t.slice(0, 10);
    if (prev && day !== prev) out.push(p.t);
    prev = day;
  }
  return out;
}

/** 각 날짜의 시작 지점 x값 + 라벨(M/D) — 날짜별 기준선용(첫 날 포함). */
export function dayStarts(points: { t: string }[]): { x: string; label: string }[] {
  const out: { x: string; label: string }[] = [];
  let prev = "";
  for (const p of points) {
    const day = p.t.slice(0, 10);
    if (day !== prev) {
      const d = new Date(p.t);
      out.push({ x: p.t, label: `${d.getMonth() + 1}/${d.getDate()}` });
      prev = day;
    }
  }
  return out;
}

/** 기간(일수)에 따라 X축 라벨을 시:분 ↔ 일자 로 전환. */
export function makeTickFormatter(days: number) {
  return (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    if (days <= 1) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (days <= 3) return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}시`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
}

/** 툴팁 헤더용 풀 라벨: "6월 16일(수) 09:40". */
export function fmtFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Mantine 스타일 커스텀 툴팁. */
export function ChartTooltip({ active, payload, label, units }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Paper p="xs" radius="md" withBorder shadow="md" style={{ minWidth: 172 }}>
      <Text size="xs" fw={700} mb={6}>{fmtFull(String(label))}</Text>
      {payload
        .filter((it: any) => it.value != null && it.name)
        .map((it: any) => (
          <Group key={it.dataKey} justify="space-between" gap="lg" wrap="nowrap" mt={2}>
            <Group gap={6} wrap="nowrap">
              <Box w={9} h={9} style={{ borderRadius: 3, background: it.color }} />
              <Text size="xs" c="dimmed">{it.name}</Text>
            </Group>
            <Text size="xs" fw={700}>{it.value}{units?.[it.dataKey] ?? ""}</Text>
          </Group>
        ))}
    </Paper>
  );
}
