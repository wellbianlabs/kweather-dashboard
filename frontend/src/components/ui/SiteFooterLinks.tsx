// 간이 푸터 — 세부 링크 없이 로고·태그라인·저작권만. (구 "Footer with links" 간소화)
import { Box, Group, Text } from "@mantine/core";

export function SiteFooterLinks() {
  return (
    <Box
      component="footer"
      mt="md"
      pt="md"
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="sm" align="center" wrap="nowrap">
          <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 20 }} />
          <Text size="xs" c="dimmed">체감온도 데이터 분석 프로그램</Text>
        </Group>
        <Text size="xs" c="dimmed">© 2026 KWeather Inc. All rights reserved.</Text>
      </Group>
    </Box>
  );
}
