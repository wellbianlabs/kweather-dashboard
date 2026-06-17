// 설정 페이지 — 테마(라이트/다크) · 폭염 임계값(표시) · 계정.
import {
  Badge, Group, Paper, SimpleGrid, Stack, Switch, Text, Title,
  useMantineColorScheme, useComputedColorScheme,
} from "@mantine/core";
import { useDashboard } from "../DashboardProvider";

const THRESHOLD_LABEL: Record<string, { label: string; color: string }> = {
  caution: { label: "관심", color: "#84cc16" },
  warning: { label: "주의", color: "#eab308" },
  danger: { label: "경고", color: "#f97316" },
  emergency: { label: "위험", color: "#dc2626" },
};

export function SettingsPage() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const { kpi, auth } = useDashboard();
  const thresholds = kpi?.thresholds ?? {};

  return (
    <Stack gap="md" maw={720}>
      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">표시 설정</Title>
        <Group justify="space-between">
          <div>
            <Text fw={600} size="sm">다크 모드</Text>
            <Text size="xs" c="dimmed">사무실(라이트) · 현장(다크) 환경에 맞춰 전환</Text>
          </div>
          <Switch
            size="md"
            checked={computed === "dark"}
            onChange={(e) => setColorScheme(e.currentTarget.checked ? "dark" : "light")}
            aria-label="dark mode"
          />
        </Group>
      </Paper>

      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">폭염 위험단계 임계값 (℃)</Title>
        {Object.keys(thresholds).length ? (
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {Object.entries(thresholds).map(([k, v]) => {
              const meta = THRESHOLD_LABEL[k] ?? { label: k, color: "#64748b" };
              return (
                <Paper key={k} withBorder radius="md" p="md" ta="center">
                  <Badge styles={{ root: { background: meta.color, color: "#fff" } }}>{meta.label}</Badge>
                  <Text fw={700} fz="xl" mt={6}>{v}℃↑</Text>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">데이터를 불러오면 임계값이 표시됩니다.</Text>
        )}
        <Text size="xs" c="dimmed" mt="sm">※ 임계값은 산업안전보건 기준에 따른 고정값입니다(편집은 추후 제공).</Text>
      </Paper>

      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">계정</Title>
        <Group justify="space-between"><Text size="sm" c="dimmed">사업장</Text><Text size="sm" fw={600}>{auth?.company_name ?? "-"}</Text></Group>
        <Group justify="space-between" mt={6}><Text size="sm" c="dimmed">이메일</Text><Text size="sm">{auth?.email ?? "-"}</Text></Group>
        {auth?.is_admin && <Badge mt="sm" color="kw" variant="light">관리자 계정</Badge>}
      </Paper>
    </Stack>
  );
}
