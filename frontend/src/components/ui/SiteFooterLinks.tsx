// 사이트 푸터 — 케이웨더몰 유도 배너 + 회사 정보(사업자등록증 기준) + 위험단계 범례.
// 구 사이트(SiteFooter)에서 노출하던 항목을 라이브 앱에 다시 표출. 테마(라이트/다크) 안전.
import { Anchor, Box, Group, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";

const MALL_URL = "https://www.kweathermall.co.kr/586";

export function SiteFooterLinks() {
  return (
    <Box component="footer" mt="md">
      {/* 케이웨더몰 유도 배너 — 더 다양한 제품 구매 유도 */}
      <Anchor href={MALL_URL} target="_blank" rel="noopener noreferrer" underline="never">
        <Box
          p="lg"
          mb="md"
          style={{
            background: "linear-gradient(90deg, var(--mantine-color-kw-6), var(--mantine-color-sky-6))",
            borderRadius: "1rem",
            color: "#fff",
          }}
        >
          <Group justify="space-between" wrap="wrap" gap="sm">
            <div>
              <Text size="xs" fw={600} c="rgba(255,255,255,0.75)">KWEATHER MALL</Text>
              <Text fw={700} fz="lg" c="#fff">폭염온도계 · 공기측정기 등 더 다양한 케이웨더 제품을 만나보세요</Text>
              <Text size="sm" c="rgba(255,255,255,0.85)">사업장 환경에 맞는 측정·환기 솔루션을 케이웨더몰에서 구매할 수 있습니다.</Text>
            </div>
            <Group gap={6} wrap="nowrap">
              <Box bg="white" px="md" py="xs" style={{ borderRadius: "0.75rem" }}>
                <Text fw={700} c="kw">케이웨더몰 바로가기</Text>
              </Box>
              <IconArrowRight size={16} color="#fff" />
            </Group>
          </Group>
        </Box>
      </Anchor>

      {/* 회사 정보(사업자등록증 기준) + 링크 */}
      <Box pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <div>
            <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 20, opacity: 0.7 }} />
            <Text size="xs" c="dimmed" mt={6}>
              케이웨더 주식회사 · 대표이사 김동식 · 사업자등록번호 110-81-37628
              <br />
              서울특별시 구로구 디지털로26길 5, 4층 401호 (구로동, 에이스하이엔드타워)
            </Text>
          </div>
          <Stack gap={2} ta="right">
            <Anchor size="xs" c="dimmed" href="https://www.kweather.com" target="_blank" rel="noopener noreferrer">
              www.kweather.com
            </Anchor>
            <Anchor size="xs" c="dimmed" href={MALL_URL} target="_blank" rel="noopener noreferrer">
              케이웨더몰 — 제품 구매
            </Anchor>
          </Stack>
        </Group>
        <Text size="xs" c="dimmed" mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
          체감온도 데이터 분석 소프트웨어 · 위험단계 기준(체감온도): 관심 31℃ / 주의 33℃ / 경고 35℃ / 위험 38℃
          <br />
          측정 데이터는 케이웨더 체감온도계 장비로 측정되며, 외부 기상자료 출처는 케이웨더(주)입니다.
          {" "}© {new Date().getFullYear()} KWeather Inc. All rights reserved.
        </Text>
      </Box>
    </Box>
  );
}
