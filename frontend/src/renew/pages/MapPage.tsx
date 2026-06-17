// 위험 지도 페이지 — 전체 위험 지도(스켈레톤) + 사업장별 단계 표 (실데이터).
import { Paper, Stack, Title } from "@mantine/core";
import { RiskMapSkeleton } from "../../components/RiskMapSkeleton";
import { DataTable } from "../../components/ui/DataTable";
import { useDashboard } from "../DashboardProvider";
import { toRiskSites, toSiteRows } from "../siteAdapters";

export function MapPage() {
  const { sites } = useDashboard();
  return (
    <Stack gap="md">
      <RiskMapSkeleton sites={toRiskSites(sites)} height={520} />
      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">사업장별 현재 위험 현황</Title>
        <DataTable rows={toSiteRows(sites)} />
      </Paper>
    </Stack>
  );
}
