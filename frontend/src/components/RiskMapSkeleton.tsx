// 위경도 기반 위험도 지도 — "스켈레톤 v1.5": 시도 외곽선(정적 GeoJSON) + 폭염 단계 마커.
// 지도 API/키/타일 없음. d3-geo 투영으로 외곽선·마커를 동일 좌표계에 렌더(런타임 fetch, public/).
// 정식 Leaflet 지도(D3)는 후속 v2.
import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { Badge, Box, Group, Loader, Paper, Text, Title, Tooltip } from "@mantine/core";
import type { HeatLevel } from "../types";

const HEAT: Record<string, HeatLevel> = {
  safe: { code: "safe", label: "안전", color: "#16a34a", rank: 0 },
  attention: { code: "attention", label: "관심", color: "#84cc16", rank: 1 },
  caution: { code: "caution", label: "주의", color: "#facc15", rank: 2 },
  warning: { code: "warning", label: "경고", color: "#f97316", rank: 3 },
  danger: { code: "danger", label: "위험", color: "#dc2626", rank: 4 },
};

export type RiskSite = { sn: string; name: string; lat: number | null; lon: number | null; feels: number; level: HeatLevel };

const SITES: RiskSite[] = [
  { sn: "DEMO-A001", name: "데모 제강 · 정련로", lat: 35.0966, lon: 128.9663, feels: 38.6, level: HEAT.danger },
  { sn: "DEMO-A002", name: "데모 제강 · 압연 B", lat: 35.097, lon: 128.967, feels: 34.2, level: HEAT.caution },
  { sn: "DEMO-B001", name: "데모 물류 · 상하차장", lat: 36.992, lon: 126.84, feels: 31.8, level: HEAT.attention },
  { sn: "DEMO-C001", name: "데모 건설 · 3공구", lat: 37.452, lon: 126.705, feels: 36.9, level: HEAT.warning },
  { sn: "DEMO-D001", name: "데모 식품 · 살균라인", lat: 35.852, lon: 128.553, feels: 37.5, level: HEAT.warning },
  { sn: "DEMO-E001", name: "데모 화학 · 반응기 A", lat: 36.351, lon: 127.385, feels: 39.2, level: HEAT.danger },
  { sn: "DEMO-F001", name: "데모 조선 · 도장공장", lat: 34.85, lon: 128.43, feels: 33.1, level: HEAT.caution },
];

const W = 520, H = 620, PAD = 16;

export function RiskMapSkeleton({
  sites = SITES,
  height = 360,
  compact = false,
}: { sites?: RiskSite[]; height?: number; compact?: boolean }) {
  const [geo, setGeo] = useState<any>(null);
  useEffect(() => {
    let on = true;
    fetch("/korea-provinces.geo.json").then((r) => r.json()).then((d) => { if (on) setGeo(d); }).catch(() => {});
    return () => { on = false; };
  }, []);

  type Placed = RiskSite & { lat: number; lon: number };
  const withCoord = sites.filter((s): s is Placed => s.lat != null && s.lon != null);
  const noCoord = sites.filter((s) => s.lat == null || s.lon == null);
  const counts: Record<string, number> = {};
  withCoord.forEach((s) => { counts[s.level.code] = (counts[s.level.code] || 0) + 1; });
  const worst = withCoord.reduce<HeatLevel | null>((a, s) => (!a || s.level.rank > a.rank ? s.level : a), null);

  const projection = useMemo(() => (geo ? geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], geo) : null), [geo]);
  const pathGen = useMemo(() => (projection ? geoPath(projection) : null), [projection]);
  const mapW = Math.round((height * W) / H);

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs">
          <Title order={3} fz="md" c="#0f172a">위험 지도</Title>
          <Badge size="xs" variant="light" color="gray">시도 외곽선 · 무API</Badge>
          {worst && <Badge size="xs" styles={{ root: { background: worst.color, color: "#fff" } }}>최고 {worst.label}</Badge>}
        </Group>
        <Text size="xs" c="dimmed" visibleFrom="sm">마커=폭염 단계 · hover 상세</Text>
      </Group>

      <Box style={{
        position: "relative", height, width: mapW, maxWidth: "100%", margin: "0 auto",
        borderRadius: 12, overflow: "hidden",
        background: "linear-gradient(135deg, var(--mantine-color-kw-0), var(--mantine-color-default-hover))",
        border: "1px solid var(--mantine-color-default-border)",
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet">
          {pathGen && geo?.features?.map((f: any, i: number) => (
            <path key={i} d={pathGen(f) ?? undefined}
              fill="var(--mantine-color-kw-1)" fillOpacity={0.55}
              stroke="var(--mantine-color-kw-4)" strokeWidth={0.6} strokeLinejoin="round" />
          ))}
          {projection && withCoord.map((s) => {
            const xy = projection([s.lon, s.lat]);
            if (!xy) return null;
            const r = 4 + s.level.rank * 1.6;
            const danger = s.level.rank >= 4;
            return (
              <Tooltip key={s.sn} label={`${s.name} · 체감 ${s.feels}℃ · ${s.level.label}`} withArrow position="top">
                <circle cx={xy[0]} cy={xy[1]} r={r} fill={s.level.color} stroke="#fff" strokeWidth={1.6}
                  style={{ cursor: "pointer", filter: danger ? `drop-shadow(0 0 4px ${s.level.color})` : undefined }} />
              </Tooltip>
            );
          })}
        </svg>
        {!geo && (
          <Box style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader size="sm" />
          </Box>
        )}
        <Text size="xs" c="dimmed" style={{ position: "absolute", right: 8, bottom: 5 }}>외곽선=시도 GeoJSON</Text>
      </Box>

      {!compact && (
        <Group mt="sm" justify="space-between" wrap="wrap">
          <Group gap="md">
            {["attention", "caution", "warning", "danger"].map((c) => (
              <Group key={c} gap={6} wrap="nowrap">
                <Box w={10} h={10} style={{ borderRadius: 999, background: HEAT[c].color }} />
                <Text size="xs" c="dimmed">{HEAT[c].label} {counts[c] || 0}</Text>
              </Group>
            ))}
          </Group>
          {noCoord.length > 0 && (
            <Text size="xs" c="dimmed">좌표 미입력 {noCoord.length}개 — 기기 등록에서 주소 검색 시 표시</Text>
          )}
        </Group>
      )}
    </Paper>
  );
}

export { SITES as DEMO_RISK_SITES };
