import { Paper, SimpleGrid, Text } from "@mantine/core";
import type { Kpi } from "../types";
import { HeatBadge } from "./HeatBadge";

function ValueCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <Paper radius="lg" p="md" withBorder shadow="xs">
      <Text size="xs" fw={500} c="dimmed">
        {label}
      </Text>
      <div style={{ marginTop: "0.375rem", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
        <Text component="span" fw={700} style={{ fontSize: 26, color: accent || "#0f172a" }}>
          {value}
        </Text>
        {unit && (
          <Text component="span" size="sm" c="dimmed">
            {unit}
          </Text>
        )}
      </div>
    </Paper>
  );
}

export function KpiCards({ kpi }: { kpi: Kpi | null }) {
  const v = (n: number | null | undefined, d = 1) => (n == null ? "-" : n.toFixed(d));
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
      <Paper
        radius="lg"
        p="md"
        withBorder
        shadow="xs"
        style={{
          background: kpi
            ? `linear-gradient(135deg,#fff 30%, ${kpi.current_level.color}1a)`
            : undefined,
        }}
      >
        <Text size="xs" fw={500} c="dimmed">
          폭염 위험 단계 (기간 최고)
        </Text>
        <div style={{ marginTop: "0.5rem" }}>
          {kpi ? <HeatBadge level={kpi.current_level} size="lg" /> : "-"}
        </div>
      </Paper>
      <ValueCard
        label="최고 체감온도 (A-TEMP)"
        value={v(kpi?.max_feels_like)}
        unit="℃"
        accent={kpi?.current_level.color}
      />
      <ValueCard label="최고 온도 (TEMP)" value={v(kpi?.max_temperature)} unit="℃" />
    </SimpleGrid>
  );
}
