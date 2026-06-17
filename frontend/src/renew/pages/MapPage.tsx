// 위험 지도 페이지 — 전체 위험 지도(스켈레톤) + 사업장별 단계 표.
import { Paper, Stack, Title } from "@mantine/core";
import { RiskMapSkeleton } from "../../components/RiskMapSkeleton";
import { DataTable } from "../../components/ui/DataTable";

export function MapPage() {
  return (
    <Stack gap="md">
      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">사업장 위험 지도</Title>
        <RiskMapSkeleton height={520} />
      </Paper>
      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">사업장별 현재 위험 현황</Title>
        <DataTable />
      </Paper>
    </Stack>
  );
}
