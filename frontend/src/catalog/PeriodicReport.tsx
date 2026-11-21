// 기간 통계(분석) 보고서 — 웹 컴포넌트 + 일자별 트렌드 차트. 일일 보고서와 동일 디자인 시스템.
import type { ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Box, Group, List, Paper, SimpleGrid, Stack, Table, Text, ThemeIcon } from "@mantine/core";
import { HeatBadge } from "../components/HeatBadge";
import { PERIODIC_CODES, PERIODIC_LEVELS, type PeriodicData } from "./periodicSample";

const THRESH: Record<string, number> = { attention: 31, caution: 33, warning: 35, danger: 38 };

function SectionTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Group gap="xs" mb="sm" wrap="nowrap" align="center">
      <ThemeIcon size={22} radius="sm" variant="filled" color="kw"><Text fz={11} fw={800} c="#fff">{n}</Text></ThemeIcon>
      <Text fw={700} size="sm">{children}</Text>
    </Group>
  );
}
function HeroCell({ label, value, unit, sub, accent, node, divider }: {
  label: string; value?: string; unit?: string; sub?: string; accent?: string; node?: ReactNode; divider?: boolean;
}) {
  return (
    <Box px="lg" py="md" style={divider ? { borderLeft: "1px solid var(--mantine-color-gray-2)" } : undefined}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: "0.04em" }}>{label}</Text>
      <Group gap={4} align="flex-end" mt={6} mih={34}>
        {node ?? (<><Text fw={800} fz={28} lh={1} style={{ color: accent ?? "var(--mantine-color-dark-9)", letterSpacing: "-0.02em" }}>{value}</Text>{unit && <Text fz="sm" fw={700} c="dimmed" mb={3}>{unit}</Text>}</>)}
      </Group>
      {sub && <Text size="xs" c="dimmed" mt={6}>{sub}</Text>}
    </Box>
  );
}
function Info({ k, v }: { k: string; v: ReactNode }) {
  return (
    <Group gap={0} wrap="nowrap" align="stretch" style={{ borderBottom: "1px solid var(--mantine-color-gray-1)" }}>
      <Box w={96} px="sm" py={8} style={{ flexShrink: 0, background: "var(--mantine-color-gray-0)" }}><Text size="xs" fw={500} c="dimmed">{k}</Text></Box>
      <Box px="sm" py={8} style={{ flex: 1, display: "flex", alignItems: "center" }}>{typeof v === "string" ? <Text size="sm">{v}</Text> : v}</Box>
    </Group>
  );
}

/** 일자별 최고 체감온도 트렌드 — 단계색 막대 + 임계선. (PDF 캡처 소스) */
export function PeriodicTrendChart({ data }: { data: PeriodicData }) {
  const rows = data.daily.map((d) => ({ date: d.date.slice(5), feels: d.max_feels, color: d.level.color }));
  const ymin = Math.max(20, Math.floor((Math.min(...rows.map((r) => r.feels)) - 3) / 5) * 5);
  const ymax = Math.ceil((Math.max(...rows.map((r) => r.feels)) + 3) / 5) * 5;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 16, right: 56, left: -6, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis unit="℃" domain={[ymin, ymax]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={42} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(v) => [`${v}℃`, "최고 체감"]} />
        {(["caution", "warning", "danger"] as const).map((c) => (
          <ReferenceLine key={c} y={THRESH[c]} stroke={PERIODIC_LEVELS[c].color} strokeDasharray="5 4"
            label={{ value: `${PERIODIC_LEVELS[c].label} ${THRESH[c]}`, position: "right", fontSize: 10, fontWeight: 600, fill: PERIODIC_LEVELS[c].color }} />
        ))}
        <Bar dataKey="feels" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={42}>
          {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 기간 통계 보고서 — 웹 레이아웃. */
export function WebPeriodicReport({ data }: { data: PeriodicData }) {
  const lv = data.peak_level;
  return (
    <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
      {/* 헤더 — 미니멀 + 식별번호 */}
      <Box px="lg" pt="lg" pb="sm" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={800} fz="xl" style={{ letterSpacing: "-0.02em" }}>폭염 안전관리 기간 분석 보고서</Text>
            <Text fz="xs" c="dimmed" mt={4}>{data.reportNo}</Text>
          </Box>
          <Box ta="right" style={{ flexShrink: 0 }}>
            <Text fz={10} c="dimmed">분석 기간</Text>
            <Text fw={700} fz="md">{data.start} ~ {data.end}</Text>
          </Box>
        </Group>
      </Box>

      {/* 요약 히어로 */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <HeroCell label="기간 최고 체감온도" value={`${data.overall_max_feels}`} unit="℃" accent={lv.color} sub="기간 내 일 최고값" />
        <HeroCell label="위험단계 도달 일수 (38℃↑)" value={`${data.danger_days}`} unit="일" accent={data.danger_days > 0 ? "#dc2626" : "#16a34a"} sub={`총 ${data.days}일 중`} divider />
        <HeroCell label="최고 위험단계" node={<HeatBadge level={lv} size="lg" />} sub="기간 내 최고 단계" divider />
      </SimpleGrid>

      {/* 문서 정보 */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Box style={{ borderRight: "1px solid var(--mantine-color-gray-2)" }}>
          <Info k="사업장" v={data.company} />
          <Info k="설치 위치" v={data.location} />
        </Box>
        <Box>
          <Info k="분석 기간" v={`${data.start} ~ ${data.end} (${data.days}일)`} />
          <Info k="측정기" v={`SN ${data.sn}`} />
        </Box>
      </SimpleGrid>

      <Stack gap="lg" p="lg">
        {/* 위험 단계별 도달 일수 */}
        <Box>
          <SectionTitle n={1}>위험 단계별 도달 일수</SectionTitle>
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Table ta="center" verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr style={{ background: "var(--mantine-color-gray-0)" }}>
                  <Table.Th ta="left" fz="xs" fw={500} c="dimmed">위험 단계</Table.Th>
                  {PERIODIC_CODES.map((c) => (
                    <Table.Th key={c} ta="center" fz="xs" fw={700} style={{ color: PERIODIC_LEVELS[c].color }}>{PERIODIC_LEVELS[c].label} ({THRESH[c]}℃↑)</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td ta="left" c="dimmed">도달 일수</Table.Td>
                  {PERIODIC_CODES.map((c) => (
                    <Table.Td key={c} fw={700} style={{ color: PERIODIC_LEVELS[c].color }}>{data.level_counts[c]}일</Table.Td>
                  ))}
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>
        </Box>

        {/* 일자별 트렌드 */}
        <Box>
          <SectionTitle n={2}>일자별 최고 체감온도 트렌드</SectionTitle>
          <PeriodicTrendChart data={data} />
          <Paper withBorder radius="md" mt="sm" style={{ overflow: "hidden" }}>
            <Table.ScrollContainer minWidth={520}>
              <Table ta="center" verticalSpacing={5} fz="xs">
                <Table.Thead>
                  <Table.Tr style={{ background: "var(--mantine-color-gray-0)" }}>
                    <Table.Th ta="left" c="dimmed">일자</Table.Th><Table.Th c="dimmed">최고 체감</Table.Th>
                    <Table.Th c="dimmed">최고 기온</Table.Th><Table.Th c="dimmed">주의(33℃↑) 노출</Table.Th><Table.Th c="dimmed">최고단계</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.daily.map((d) => (
                    <Table.Tr key={d.date}>
                      <Table.Td ta="left">{d.date}</Table.Td>
                      <Table.Td fw={700} style={{ color: d.level.color }}>{d.max_feels}℃</Table.Td>
                      <Table.Td>{d.max_temp}℃</Table.Td>
                      <Table.Td>{d.minutes_over_33 > 0 ? `${Math.floor(d.minutes_over_33 / 60)}시간 ${d.minutes_over_33 % 60}분` : "0분"}</Table.Td>
                      <Table.Td><HeatBadge level={d.level} size="sm" /></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </Box>

        {/* 종합 분석 */}
        <Box>
          <SectionTitle n={3}>종합 분석 및 권고</SectionTitle>
          <List spacing={6} size="sm" center icon={<Text span c="kw" fz={10} lh={1}>○</Text>}>
            {data.analysis.map((a, i) => <List.Item key={i}>{a}</List.Item>)}
          </List>
        </Box>

        <Text size="xs" c="dimmed" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-1)", lineHeight: 1.6 }}>
          측정기기: 케이웨더(주) 체감온도계 (기기: {data.sn}) · 모든 측정 데이터는 케이웨더(주) 체감온도계 장비로 측정·수집되었으며, 외부 기상자료를 포함한 출처는 케이웨더(주)입니다.
        </Text>
      </Stack>
    </Paper>
  );
}
