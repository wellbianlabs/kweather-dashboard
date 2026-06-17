// 기간 통계 보고서 2칼럼 워크스페이스 (독립 URL /periodic-report-studio.html).
// 상단 편집 컨트롤 → 웹/PDF 즉시 갱신. 트렌드 차트=recharts PNG 캡처.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Box, Button, Group, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput,
} from "@mantine/core";
import { toPng } from "html-to-image";
import { IconDownload } from "@tabler/icons-react";
import { PeriodicTrendChart, WebPeriodicReport } from "./PeriodicReport";
import { buildPeriodicData, PERIODIC_DEFAULT, type PeriodicParams } from "./periodicSample";
import { renderPeriodicReportHtml } from "./periodicReportHtml";
import { downloadHtml } from "./downloadHtml";

const A4_W = 794;
const CAP_W = 980;

export function PeriodicReportStudio() {
  const [params, setParams] = useState<PeriodicParams>(PERIODIC_DEFAULT);
  const data = useMemo(() => buildPeriodicData(params), [params]);

  const trendRef = useRef<HTMLDivElement>(null);
  const iref = useRef<HTMLIFrameElement>(null);
  const [trend, setTrend] = useState<string | undefined>();
  const [capturing, setCapturing] = useState(true);

  useEffect(() => {
    setCapturing(true);
    const t = setTimeout(async () => {
      try {
        const png = trendRef.current
          ? await toPng(trendRef.current, { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true })
          : undefined;
        setTrend(png);
      } catch (e) {
        console.error("trend capture failed", e);
      } finally {
        setCapturing(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [data]);

  const pdfHtml = useMemo(
    () => renderPeriodicReportHtml(data, { previewMargins: true, trendChart: trend ?? null }),
    [data, trend],
  );

  const fit = () => {
    const f = iref.current;
    try {
      const doc = f?.contentWindow?.document;
      if (doc) f!.style.height = `${doc.body.scrollHeight + 8}px`;
    } catch { /* noop */ }
  };

  const num = (key: keyof PeriodicParams, label: string, props: Record<string, unknown> = {}) => (
    <NumberInput size="xs" label={label} value={params[key] as number}
      onChange={(v) => setParams((p) => ({ ...p, [key]: Number(v) || 0 }))} {...props} />
  );
  const txt = (key: keyof PeriodicParams, label: string) => (
    <TextInput size="xs" label={label} value={params[key] as string}
      onChange={(e) => setParams((p) => ({ ...p, [key]: e.currentTarget.value }))} />
  );

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs"><Badge color="kw" radius="sm">데이터 편집</Badge><Text size="xs" c="dimmed">값 변경 시 웹·PDF 즉시 갱신(차트는 ~0.7s 후 재캡처)</Text></Group>
          <Button size="xs" variant="default" onClick={() => setParams(PERIODIC_DEFAULT)}>기본값 복원</Button>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm" verticalSpacing="sm">
          {txt("company", "사업장")}
          {txt("location", "설치 위치")}
          {txt("sn", "측정기 SN")}
          {txt("startDate", "시작 일자")}
          {num("days", "분석 일수", { min: 1, max: 31 })}
          {num("baseMaxFeels", "일 최고 체감 하한(℃)", { step: 0.5, min: 20, max: 45 })}
          {num("peakMaxFeels", "일 최고 체감 상한(℃)", { step: 0.5, min: 20, max: 50 })}
        </SimpleGrid>
      </Paper>

      {/* 오프스크린 캡처 소스 */}
      <Box style={{ position: "absolute", left: -99999, top: 0, width: CAP_W, pointerEvents: "none" }} aria-hidden>
        <div ref={trendRef} style={{ width: CAP_W, background: "#fff" }}><PeriodicTrendChart data={data} /></div>
      </Box>

      <Group align="flex-start" gap="xl" wrap="nowrap" style={{ minWidth: "min-content" }}>
        <Stack gap={8} style={{ flex: 1, minWidth: 460 }}>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color="kw" radius="sm">웹 보고서</Badge>
            <Text size="xs" c="dimmed" truncate>catalog/PeriodicReport.tsx · WebPeriodicReport</Text>
          </Group>
          <WebPeriodicReport data={data} />
        </Stack>

        <Stack gap={8} style={{ flexShrink: 0, width: A4_W }}>
          <Group gap="xs" wrap="nowrap" justify="space-between">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <Badge variant="light" color="grape" radius="sm">PDF 생성전 HTML</Badge>
              <Text size="xs" c="dimmed" truncate>_PERIODIC_TEMPLATE (xhtml2pdf · A4)</Text>
              {capturing && <Badge variant="light" color="yellow" radius="sm" size="sm">캡처 중…</Badge>}
            </Group>
            <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} disabled={capturing}
              onClick={() => downloadHtml(pdfHtml, `폭염안전관리_기간보고서_${data.start}_${data.end}_${data.sn}.html`)}>
              HTML 내보내기
            </Button>
          </Group>
          <Box style={{ width: A4_W, background: "#fff", boxShadow: "0 2px 14px rgba(15,23,42,0.13)", border: "1px solid var(--mantine-color-gray-3)" }}>
            <iframe ref={iref} title="periodic-pdf-html" srcDoc={pdfHtml} onLoad={fit}
              style={{ width: A4_W, height: 1200, border: 0, background: "#fff", display: "block" }} />
          </Box>
          <Text size="xs" c="dimmed" maw={A4_W}>※ 차트는 웹 recharts 를 PNG 캡처해 임베드(웹=PDF). 실 PDF는 xhtml2pdf 변환.</Text>
        </Stack>
      </Group>
    </Stack>
  );
}
