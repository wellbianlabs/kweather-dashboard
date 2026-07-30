import { Paper, SimpleGrid, Text } from "@mantine/core";
import type { Kpi } from "../types";
import { HeatBadge } from "./HeatBadge";

function ValueCard({ label, value, unit, accent, sub }:
  { label: string; value: string; unit?: string; accent?: string; sub?: string }) {
  return (
    <Paper radius="lg" p="md" withBorder shadow="xs">
      <Text size="xs" fw={500} c="dimmed">{label}</Text>
      <div style={{ marginTop: "0.375rem", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
        <Text component="span" fw={700} style={{ fontSize: 26, color: accent || "#0f172a" }}>{value}</Text>
        {unit && <Text component="span" size="sm" c="dimmed">{unit}</Text>}
      </div>
      <Text size="xs" c="dimmed" mt={4} style={{ minHeight: 16 }}>{sub || ""}</Text>
    </Paper>
  );
}

// 분 -> "X시간 Y분" / "Y분" 보기 좋게
function fmtDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return "0분";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function KpiCards({ kpi }: { kpi: Kpi | null }) {
  const v = (n: number | null | undefined, d = 1) => (n == null ? "-" : n.toFixed(d));
  const danger = kpi?.danger_minutes ?? 0;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
      <Paper radius="lg" p="md" withBorder shadow="xs"
        style={{ background: kpi ? `linear-gradient(135deg,#fff 30%, ${kpi.current_level.color}1a)` : undefined }}>
        <Text size="xs" fw={500} c="dimmed">폭염 위험 단계 (기간 최고)</Text>
        <div style={{ marginTop: "0.5rem" }}>{kpi ? <HeatBadge level={kpi.current_level} size="lg" /> : "-"}</div>
      </Paper>
      <ValueCard
        label="최고 체감온도 (A-TEMP)"
        value={v(kpi?.max_feels_like)}
        unit="℃"
        accent={kpi?.current_level.color}
        sub={kpi?.max_feels_like_time ? `${kpi.max_feels_like_time} 발생` : ""}
      />
      <ValueCard
        label="최고 온도 (TEMP)"
        value={v(kpi?.max_temperature)}
        unit="℃"
        sub={kpi?.max_temperature_time ? `${kpi.max_temperature_time} 발생` : ""}
      />
      <ValueCard
        label="위험단계 이상 지속 (체감 38℃↑)"
        value={fmtDuration(danger)}
        accent={danger > 0 ? "#dc2626" : undefined}
        sub={danger > 0 ? "온열질환 고위험 누적" : "위험단계 미발생"}
      />
    </SimpleGrid>
  );
}
