import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Container, Stack, Group, Title, Text, Button, SegmentedControl, Alert, Paper,
  SimpleGrid, Table, Badge,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { api } from "../api";
import type { AdminOverview } from "../types";

const KIND_LABEL: Record<string, string> = {
  visit: "방문/인증", upload: "업로드", report: "리포트", api: "조회",
};
const KIND_COLOR: Record<string, string> = {
  visit: "blue", upload: "teal", report: "grape", api: "gray",
};

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Paper radius="lg" p="md" withBorder shadow="xs">
      <Text fz="xs" c="dimmed" fw={500}>{label}</Text>
      <Text fz="xl" fw={700} c={accent} mt={4}>{value}</Text>
      {sub && <Text fz="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Paper>
  );
}

export function AdminPage({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    api.adminOverview(days)
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const n = (v: number) => v.toLocaleString();

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <div>
            <Title order={2} fz="lg">관리자 대시보드</Title>
            <Text fz="xs" c="dimmed">
              일 방문 · 이용 트래픽 · 데이터 업로드 현황 {data && `· 기준 ${data.generated_at} (KST)`}
            </Text>
          </div>
          <Group gap="xs">
            <SegmentedControl
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
              data={[{ label: "7일", value: "7" }, { label: "14일", value: "14" }, { label: "30일", value: "30" }]}
              size="xs"
            />
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={load}>새로고침</Button>
            <Button onClick={onClose}>대시보드로</Button>
          </Group>
        </Group>

        {err && <Alert color="red" variant="light">{err}</Alert>}
        {loading && !data && <Text c="dimmed" ta="center" py="xl">불러오는 중...</Text>}

        {data && (
          <>
            {/* 오늘 지표 */}
            <div>
              <Text fz="sm" fw={600} c="#334155" mb="xs">오늘 현황</Text>
              <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
                <Kpi label="오늘 방문(고유)" value={n(data.today.visits)} accent="kw" />
                <Kpi label="오늘 요청(트래픽)" value={n(data.today.requests)} />
                <Kpi label="오늘 업로드" value={`${n(data.today.uploads)}건`} sub={`${n(data.today.rows)}행 반영`} accent="teal.7" />
                <Kpi label="오늘 신규가입" value={n(data.today.signups)} />
                <Kpi label="누적 측정행" value={n(data.totals.rows)} sub={`회원 ${n(data.totals.members)} · 기기 ${n(data.totals.devices)}`} />
              </SimpleGrid>
            </div>

            {/* 일자별 추이 */}
            <Paper radius="lg" p="lg" withBorder shadow="xs">
              <Title order={3} fz="md" c="#0f172a" mb="xs">일자별 이용 추이 (최근 {days}일)</Title>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20}
                         tickFormatter={(d) => String(d).slice(5)} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="requests" name="요청수" fill="#dbe7f7" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="l" dataKey="uploads" name="업로드" fill="#a7f3d0" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="visits" name="방문(고유)" stroke="#0f499e" strokeWidth={2.2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="signups" name="신규가입" stroke="#f97316" strokeWidth={1.6} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>

            {/* 테넌트별 현황 */}
            <Paper radius="lg" p="lg" withBorder shadow="xs">
              <Title order={3} fz="md" c="#0f172a" mb="md">사업장(회원)별 데이터 현황</Title>
              <Table.ScrollContainer minWidth={720}>
                <Table verticalSpacing="xs" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>회사</Table.Th>
                      <Table.Th>이메일</Table.Th>
                      <Table.Th ta="right">기기</Table.Th>
                      <Table.Th ta="right">측정행</Table.Th>
                      <Table.Th>데이터 기간</Table.Th>
                      <Table.Th>가입일</Table.Th>
                      <Table.Th>최근 활동</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.tenants.map((t) => (
                      <Table.Tr key={t.id}>
                        <Table.Td fw={500} c="#1e293b">
                          {t.company}
                          {t.is_demo && <Badge size="xs" variant="light" color="gray" ml={6}>데모</Badge>}
                        </Table.Td>
                        <Table.Td c="dimmed">{t.email ?? "—"}</Table.Td>
                        <Table.Td ta="right">{n(t.devices)}</Table.Td>
                        <Table.Td ta="right">{n(t.rows)}</Table.Td>
                        <Table.Td fz="xs" c="dimmed">
                          {t.first_date ? `${t.first_date} ~ ${t.last_date}` : "—"}
                        </Table.Td>
                        <Table.Td fz="xs" c="dimmed">{t.created_at ?? "—"}</Table.Td>
                        <Table.Td fz="xs" c="dimmed">{t.last_active ?? "—"}</Table.Td>
                      </Table.Tr>
                    ))}
                    {data.tenants.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={7} ta="center" c="dimmed" py="md">회원이 없습니다.</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            {/* 최근 이벤트 */}
            <Paper radius="lg" p="lg" withBorder shadow="xs">
              <Title order={3} fz="md" c="#0f172a" mb="md">최근 접근 로그</Title>
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>시각</Table.Th>
                      <Table.Th>구분</Table.Th>
                      <Table.Th>회사</Table.Th>
                      <Table.Th>요청</Table.Th>
                      <Table.Th ta="right">상태</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.recent.map((e, i) => (
                      <Table.Tr key={i}>
                        <Table.Td ff="monospace" fz="xs" c="dimmed">{e.ts}</Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={KIND_COLOR[e.kind] ?? KIND_COLOR.api}>
                            {KIND_LABEL[e.kind] ?? e.kind}
                          </Badge>
                        </Table.Td>
                        <Table.Td c="#475569">{e.company ?? (e.email ?? "익명")}</Table.Td>
                        <Table.Td ff="monospace" fz="xs" c="dimmed">{e.method} {e.path}</Table.Td>
                        <Table.Td ta="right" c={e.status >= 400 ? "red" : "dimmed"}>{e.status}</Table.Td>
                      </Table.Tr>
                    ))}
                    {data.recent.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5} ta="center" c="dimmed" py="md">기록이 없습니다.</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
