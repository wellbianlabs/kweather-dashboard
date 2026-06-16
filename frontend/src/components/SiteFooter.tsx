import { Anchor, Box, Container, Group, Image, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";

const MALL_URL = "https://www.kweathermall.co.kr/586";

/** 케이웨더몰 유도 배너 — 사이트 하단, 푸터 바로 위. */
export function MallBanner() {
  return (
    <Container size="xl" px="md" pb="xs">
      <Anchor href={MALL_URL} target="_blank" rel="noopener noreferrer" underline="never">
        <Box
          p="lg"
          style={{
            background: "linear-gradient(90deg, var(--mantine-color-kw-6), var(--mantine-color-sky-6))",
            borderRadius: "1rem",
            color: "#fff",
          }}
        >
          <Group justify="space-between">
            <div>
              <Text size="xs" fw={600} c="rgba(255,255,255,0.7)">
                KWEATHER MALL
              </Text>
              <Text fw={700} fz="lg">
                폭염온도계 · 공기측정기 등 더 다양한 케이웨더 제품을 만나보세요
              </Text>
              <Text size="sm" c="rgba(255,255,255,0.8)">
                사업장 환경에 맞는 측정·환기 솔루션을 케이웨더몰에서 구매할 수 있습니다.
              </Text>
            </div>
            <Group gap={6}>
              <Box bg="white" px="md" py="xs" style={{ borderRadius: "0.75rem" }}>
                <Text fw={700} c="kw">
                  케이웨더몰 바로가기
                </Text>
              </Box>
              <IconArrowRight size={16} color="var(--mantine-color-kw-6)" />
            </Group>
          </Group>
        </Box>
      </Anchor>
    </Container>
  );
}

/** 회사 정보 푸터 — 사업자등록증 기준. */
export function SiteFooter({ withBanner = false }: { withBanner?: boolean }) {
  return (
    <>
      {withBanner && <MallBanner />}
      <Box
        component="footer"
        mt="md"
        bg="white"
        style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
      >
        <Container size="xl" py="xl">
          <Group justify="space-between" align="flex-start">
            <div>
              <Image src="/kweather-logo.png" alt="KWEATHER" h={20} w="auto" style={{ opacity: 0.7 }} />
              <Text size="xs" c="dimmed">
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
          <Text
            size="xs"
            c="dimmed"
            mt="lg"
            pt="md"
            style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}
          >
            체감온도계 안전보건 대시보드 · 위험단계 기준(체감온도): 관심 31℃ / 주의 33℃ / 경고 35℃ / 위험 38℃
            <br />
            측정 데이터는 케이웨더 체감온도계 장비로 측정되며, 외부 기상자료 출처는 케이웨더(주)입니다.
            © {new Date().getFullYear()} KWeather Inc. All rights reserved.
          </Text>
        </Container>
      </Box>
    </>
  );
}
