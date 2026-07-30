import type { Kpi } from "../types";
import { Box, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

/* 정부 발표 폭염 단계별 대응 지침
   근거: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」(2026.5.13.),
        산업안전보건기준에 관한 규칙 제566조, 기상청 폭염특보(중대경보 신설) */
const GUIDELINES = [
  {
    code: "attention", label: "관심", temp: "31", color: "#84cc16",
    advisory: "예방 단계", summary: "예방수칙 가동",
    actions: ["폭염안전 5대 기본수칙 점검", "그늘·냉방 휴게장소 사전 확보", "민감군(고령·기저질환) 사전 파악"],
  },
  {
    code: "caution", label: "주의", temp: "33", color: "#eab308",
    advisory: "폭염주의보", summary: "2시간마다 20분 휴식",
    actions: ["2시간마다 20분 이상 휴식 (법적 의무)", "작업시간대 조정·옥외작업 단축", "충분한 음용수·건강상태 수시 확인"],
  },
  {
    code: "warning", label: "경고", temp: "35", color: "#f97316",
    advisory: "폭염경보", summary: "14~17시 옥외작업 중지",
    actions: ["무더위 시간대(14~17시) 옥외작업 중지", "2시간마다 20분 이상 휴식", "작업시간 조기·야간 전환"],
  },
  {
    code: "danger", label: "위험", temp: "38", color: "#dc2626",
    advisory: "폭염중대경보 (신설)", summary: "옥외작업 중지",
    actions: ["긴급조치 작업 외 옥외작업 중지", "2시간마다 20분 휴식·건강상태 확인", "의심 증상 시 즉시 중단·119"],
  },
];

/* 폭염안전 5대 기본수칙 (산업안전보건규칙 개정으로 법제화된 사업주 보건조치) */
const RULES = [
  { k: "물", d: "시원한 물" },
  { k: "냉방", d: "냉방장치" },
  { k: "휴식", d: "2시간마다 20분" },
  { k: "보냉", d: "개인 보냉장구" },
  { k: "119", d: "응급 신고" },
];

export function HeatGuidelines({ kpi }: { kpi: Kpi | null }) {
  const current = kpi?.current_level?.code;
  const activeIdx = GUIDELINES.findIndex((g) => g.code === current);

  return (
    <Paper radius="lg" p="xl" withBorder shadow="xs">
      {/* 헤더 + 5대 수칙 */}
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Box style={{ flex: "1 1 320px" }}>
          <Title order={3} fz="xl" fw={800} c="#0f172a">폭염 단계별 안전조치 기준</Title>
          <Text mt={4} fz={13} c="dimmed">
            고용노동부 「2026 폭염 대비 노동자 건강보호 대책」 · 폭염특보: 주의보 33℃ / 경보 35℃ / 중대경보 38℃(신설) · 체감 33℃↑ 작업 시 2시간마다 20분 휴식 법제화
          </Text>
        </Box>
        <Box style={{ flexShrink: 0 }}>
          <Text fz={10} fw={700} tt="uppercase" c="dimmed" mb={6}>폭염안전 5대 기본수칙 · 법적 의무</Text>
          <Group gap="xs">
            {RULES.map((r) => (
              <Box key={r.k} bg="kw.0" px="sm" py="xs" ta="center" style={{ borderRadius: "1rem" }}>
                <Text fz="sm" fw={800} c="kw" lh={1.1}>{r.k}</Text>
                <Text mt={2} fz={10} fw={500} c="kw" style={{ opacity: 0.6 }}>{r.d}</Text>
              </Box>
            ))}
          </Group>
        </Box>
      </Group>

      {/* 단계 스펙트럼 바 */}
      <Box mt="lg">
        <Group gap={0} style={{ overflow: "hidden", borderRadius: 999 }}>
          {GUIDELINES.map((g, i) => (
            <Box key={g.code} style={{
              height: 12, flex: 1, background: g.color,
              opacity: activeIdx === -1 || activeIdx === i ? 1 : 0.25, transition: "all .2s",
            }} />
          ))}
        </Group>
        <Group gap={0} mt={6}>
          {GUIDELINES.map((g) => (
            <Text key={g.code} style={{ flex: 1 }} fz={11} fw={600} c="dimmed">체감 {g.temp}℃~</Text>
          ))}
        </Group>
      </Box>

      {/* 단계 카드 */}
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md" mt="md">
        {GUIDELINES.map((g) => {
          const active = current === g.code;
          return (
            <Paper key={g.code} radius="lg" withBorder={!active} shadow={active ? "md" : "xs"}
              style={{ overflow: "hidden", outline: active ? `2px solid ${g.color}` : undefined }}>
              {/* 컬러 헤더 밴드 */}
              <Box px="md" pt="md" pb="sm" c="white" style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color}d9)` }}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Box>
                    <Group gap={6} align="center">
                      <Text fz={19} fw={800} lh={1}>{g.label}</Text>
                      <Box px={6} py={2} style={{ background: "rgba(255,255,255,.25)", borderRadius: 4 }}>
                        <Text fz={9} fw={700} lh={1}>{g.advisory}</Text>
                      </Box>
                    </Group>
                    <Text mt={6} fz={11} fw={600} style={{ color: "rgba(255,255,255,.85)" }}>{g.summary}</Text>
                  </Box>
                  <Box ta="right" style={{ lineHeight: 1 }}>
                    <Text span fz={30} fw={800}>{g.temp}</Text>
                    <Text span fz="sm" fw={700} style={{ color: "rgba(255,255,255,.85)" }}>℃~</Text>
                  </Box>
                </Group>
                {active && (
                  <Box mt="xs" px="sm" py={4} bg="white"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, color: g.color }}>
                    <Box style={{ width: 8, height: 8, borderRadius: 999, background: g.color }} />
                    <Text fz={11} fw={800}>현재 해당 단계</Text>
                  </Box>
                )}
              </Box>
              {/* 조치사항 */}
              <Stack gap="xs" px="md" py="md">
                {g.actions.map((a, i) => (
                  <Group key={i} gap={8} align="flex-start" wrap="nowrap">
                    <Box style={{ color: g.color, marginTop: 2, flexShrink: 0, display: "inline-flex" }}>
                      <IconCheck size={14} />
                    </Box>
                    <Text fz={13} fw={500} lh={1.35} c="#334155">{a}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Text mt="lg" pt="sm" ta="right" fz={11} c="dimmed" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
        근거: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」(2026.5.13.) · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보(중대경보 신설)
      </Text>
    </Paper>
  );
}
