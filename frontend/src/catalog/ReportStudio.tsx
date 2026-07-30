// 일일 보고서 리디자인 2칼럼 워크스페이스 (독립 URL /report-studio.html).
// 상단 편집 컨트롤로 핵심 값을 임의 입력 → 웹/PDF 즉시 갱신. 차트=recharts PNG 캡처.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Box, Button, Group, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput,
} from "@mantine/core";
import {
  CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toPng } from "html-to-image";
import { IconDownload } from "@tabler/icons-react";
import { HourlyChart, HourlyTable, WebReport } from "../components/ReportPanel";
import { ChartTooltip } from "../components/chartkit";
import { buildReportData, DEFAULT_PARAMS, type ReportParams, type PdfData } from "./reportSample";
import { renderDailyReportHtml } from "./dailyReportHtml";
import { downloadHtml } from "./downloadHtml";

const A4_W = 794;
const CAP_W = 980;

function ReportCompareChart({ hours }: { hours: PdfData["hours"] }) {
  const data = hours.map((h) => ({ t: `${String(h.hour).padStart(2, "0")}시`, 현장: h.feels, 야외: h.out_feels }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={24} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
        <YAxis unit="℃" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
        <Tooltip content={<ChartTooltip units={{ 현장: "℃", 야외: "℃" }} />} />
        <Legend verticalAlign="top" align="right" height={26} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="야외" stroke="#1790cd" strokeWidth={2.4} dot={{ r: 2.5, fill: "#fff", stroke: "#1790cd", strokeWidth: 1.5 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="현장" stroke="#dc2626" strokeWidth={2.4} dot={{ r: 2.5, fill: "#fff", stroke: "#dc2626", strokeWidth: 1.5 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ReportStudio() {
  const [params, setParams] = useState<ReportParams>(DEFAULT_PARAMS);
  const { daily, pdf } = useMemo(() => buildReportData(params), [params]);

  const hourlyRef = useRef<HTMLDivElement>(null);
  const cmpRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<HTMLDivElement>(null);
  const iref = useRef<HTMLIFrameElement>(null);
  const [charts, setCharts] = useState<{ hourly?: string; compare?: string; heatmap?: string }>({});
  const [capturing, setCapturing] = useState(true);

  // 데이터 변경 시 차트 재렌더 후 PNG 캡처(타임아웃이 디바운스 역할)
  useEffect(() => {
    setCapturing(true);
    const t = setTimeout(async () => {
      const opts = { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true };
      const cap = (el: HTMLElement | null) => (el ? toPng(el, opts) : Promise.resolve(undefined));
      try {
        const [hourly, compare, heatmap] = await Promise.all([cap(hourlyRef.current), cap(cmpRef.current), cap(heatRef.current)]);
        setCharts({ hourly, compare, heatmap });
      } catch (e) {
        console.error("chart capture failed", e);
      } finally {
        setCapturing(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [daily, pdf]);

  const pdfHtml = useMemo(
    () => renderDailyReportHtml(pdf, {
      previewMargins: true,
      chartHourly: charts.hourly ?? null,
      chartCompare: charts.compare ?? null,
      heatmap: charts.heatmap ?? null,
    }),
    [pdf, charts],
  );

  const fit = () => {
    const f = iref.current;
    try {
      const doc = f?.contentWindow?.document;
      if (doc) f!.style.height = `${doc.body.scrollHeight + 8}px`;
    } catch { /* noop */ }
  };

  const num = (key: keyof ReportParams, label: string, props: Record<string, unknown> = {}) => (
    <NumberInput size="xs" label={label} value={params[key] as number}
      onChange={(v) => setParams((p) => ({ ...p, [key]: Number(v) || 0 }))} {...props} />
  );
  const txt = (key: keyof ReportParams, label: string, w?: number) => (
    <TextInput size="xs" label={label} w={w} value={params[key] as string}
      onChange={(e) => setParams((p) => ({ ...p, [key]: e.currentTarget.value }))} />
  );

  return (
    <Stack gap="md">
      {/* 편집 컨트롤 — 각 값 임의 적용 */}
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs"><Badge color="kw" radius="sm">데이터 편집</Badge><Text size="xs" c="dimmed">값 변경 시 웹·PDF 즉시 갱신(차트는 ~0.7s 후 재캡처)</Text></Group>
          <Button size="xs" variant="default" onClick={() => setParams(DEFAULT_PARAMS)}>기본값 복원</Button>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm" verticalSpacing="sm">
          {txt("company", "사업장")}
          {txt("location", "설치 위치")}
          {txt("address", "소재지")}
          {txt("sn", "측정기 SN")}
          {txt("date", "대상 일자")}
          {num("humidity", "평균 습도(%)", { min: 0, max: 100 })}
          {num("baseFeels", "기준 체감(℃)", { step: 0.5, min: 10, max: 45 })}
          {num("peakFeels", "최고 체감(℃)", { step: 0.1, min: 10, max: 50 })}
          {num("peakHour", "피크 시각(0~23)", { min: 0, max: 23 })}
          {num("maxTemp", "최고 기온(℃)", { step: 0.1, min: 10, max: 50 })}
          {num("extDiff", "외부 체감차(℃)", { step: 0.1, min: -5, max: 15 })}
        </SimpleGrid>
      </Paper>

      {/* 오프스크린 캡처 소스 */}
      <Box style={{ position: "absolute", left: -99999, top: 0, width: CAP_W, pointerEvents: "none" }} aria-hidden>
        <div ref={hourlyRef} style={{ width: CAP_W, background: "#fff" }}><HourlyChart hours={daily.hours} animate={false} /></div>
        <div ref={cmpRef} style={{ width: CAP_W, background: "#fff" }}><ReportCompareChart hours={pdf.hours} /></div>
        <div ref={heatRef} style={{ width: CAP_W, background: "#fff", padding: "6px 4px" }}><HourlyTable hours={daily.hours} /></div>
      </Box>

      <Group align="flex-start" gap="xl" wrap="nowrap" style={{ minWidth: "min-content" }}>
        {/* 좌: 웹 보고서 */}
        <Stack gap={8} style={{ flex: 1, minWidth: 460 }}>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color="kw" radius="sm">웹 보고서</Badge>
            <Text size="xs" c="dimmed" truncate>ReportPanel.tsx · WebReport</Text>
          </Group>
          <WebReport report={daily} deviceSn={params.sn} />
        </Stack>

        {/* 우: PDF 생성전 HTML */}
        <Stack gap={8} style={{ flexShrink: 0, width: A4_W }}>
          <Group gap="xs" wrap="nowrap" justify="space-between">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <Badge variant="light" color="grape" radius="sm">PDF 생성전 HTML</Badge>
              <Text size="xs" c="dimmed" truncate>_DAILY_TEMPLATE (xhtml2pdf · A4)</Text>
              {capturing && <Badge variant="light" color="yellow" radius="sm" size="sm">캡처 중…</Badge>}
            </Group>
            <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} disabled={capturing}
              onClick={() => downloadHtml(pdfHtml, `폭염안전관리_일일보고서_${params.date}_${params.sn}.html`)}>
              HTML 내보내기
            </Button>
          </Group>
          <Box style={{ width: A4_W, background: "#fff", boxShadow: "0 2px 14px rgba(15,23,42,0.13)", border: "1px solid var(--mantine-color-gray-3)" }}>
            <iframe ref={iref} title="daily-pdf-html" srcDoc={pdfHtml} onLoad={fit}
              style={{ width: A4_W, height: 1400, border: 0, background: "#fff", display: "block" }} />
          </Box>
          <Text size="xs" c="dimmed" maw={A4_W}>※ 차트는 웹 recharts 를 PNG 캡처해 임베드(웹=PDF). 실 PDF는 xhtml2pdf 변환.</Text>
        </Stack>
      </Group>
    </Stack>
  );
}
