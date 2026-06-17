// 일일 보고서 리디자인 2칼럼 워크스페이스 (독립 URL /report-studio.html).
// 좌: 실 WebReport · 우: PDF 생성전 HTML(A4, xhtml2pdf 호환).
// 차트 = 웹 recharts 를 그대로 PNG 캡처(html-to-image)해 PDF 에 임베드 → 웹과 픽셀 동일, 백엔드 차트엔진 불필요.
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import {
  CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toPng } from "html-to-image";
import { HourlyChart, HourlyTable, WebReport } from "../components/ReportPanel";
import { ChartTooltip } from "../components/chartkit";
import { SAMPLE_DAILY, SAMPLE_PDF, SAMPLE_SN } from "./reportSample";
import { renderDailyReportHtml } from "./dailyReportHtml";

const A4_W = 794; // 210mm @ 96dpi
const CAP_W = 980; // 캡처 폭(가로형 차트)

/** PDF 임베드용 내·외부 비교 recharts 차트 (캡처 소스). */
function ReportCompareChart() {
  const data = SAMPLE_PDF.hours.map((h) => ({ t: `${String(h.hour).padStart(2, "0")}시`, 현장: h.feels, 야외: h.out_feels }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dc2626" stopOpacity={0.16} /><stop offset="100%" stopColor="#dc2626" stopOpacity={0} /></linearGradient>
        </defs>
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
  const hourlyRef = useRef<HTMLDivElement>(null);
  const cmpRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<HTMLDivElement>(null);
  const iref = useRef<HTMLIFrameElement>(null);
  const [charts, setCharts] = useState<{ hourly?: string; compare?: string; heatmap?: string }>({});
  const [capturing, setCapturing] = useState(true);

  // recharts/히트맵 렌더 후 PNG 캡처
  useEffect(() => {
    const t = setTimeout(async () => {
      const opts = { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true }; // 고해상도(3×)
      const cap = (el: HTMLElement | null) => (el ? toPng(el, opts) : Promise.resolve(undefined));
      try {
        const [hourly, compare, heatmap] = await Promise.all([
          cap(hourlyRef.current), cap(cmpRef.current), cap(heatRef.current),
        ]);
        setCharts({ hourly, compare, heatmap });
      } catch (e) {
        console.error("chart capture failed", e);
      } finally {
        setCapturing(false);
      }
    }, 700); // 애니메이션/폰트 안정화 대기
    return () => clearTimeout(t);
  }, []);

  const pdfHtml = useMemo(
    () => renderDailyReportHtml(SAMPLE_PDF, {
      previewMargins: true,
      chartHourly: charts.hourly ?? null,
      chartCompare: charts.compare ?? null,
      heatmap: charts.heatmap ?? null,
    }),
    [charts],
  );

  const fit = () => {
    const f = iref.current;
    try {
      const doc = f?.contentWindow?.document;
      if (doc) f!.style.height = `${doc.body.scrollHeight + 8}px`;
    } catch { /* noop */ }
  };

  return (
    <>
      {/* 오프스크린 캡처 소스 — recharts 차트(PDF 임베드용 PNG 생성) */}
      <Box style={{ position: "absolute", left: -99999, top: 0, width: CAP_W, pointerEvents: "none" }} aria-hidden>
        <div ref={hourlyRef} style={{ width: CAP_W, background: "#fff" }}><HourlyChart hours={SAMPLE_DAILY.hours} animate={false} /></div>
        <div ref={cmpRef} style={{ width: CAP_W, background: "#fff" }}><ReportCompareChart /></div>
        <div ref={heatRef} style={{ width: CAP_W, background: "#fff", padding: "6px 4px" }}><HourlyTable hours={SAMPLE_DAILY.hours} /></div>
      </Box>

      <Group align="flex-start" gap="xl" wrap="nowrap" style={{ minWidth: "min-content" }}>
        {/* 좌: 웹 보고서 */}
        <Stack gap={8} style={{ flex: 1, minWidth: 460 }}>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color="kw" radius="sm">웹 보고서</Badge>
            <Text size="xs" c="dimmed" truncate>src/components/ReportPanel.tsx · WebReport</Text>
          </Group>
          <WebReport report={SAMPLE_DAILY} deviceSn={SAMPLE_SN} />
        </Stack>

        {/* 우: PDF 생성전 HTML (A4) */}
        <Stack gap={8} style={{ flexShrink: 0, width: A4_W }}>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color="grape" radius="sm">PDF 생성전 HTML</Badge>
            <Text size="xs" c="dimmed" truncate>_DAILY_TEMPLATE (xhtml2pdf · A4) · 차트=recharts PNG</Text>
            {capturing && <Badge variant="light" color="yellow" radius="sm" size="sm">차트 캡처 중…</Badge>}
          </Group>
          <Box style={{ width: A4_W, background: "#fff", boxShadow: "0 2px 14px rgba(15,23,42,0.13)", border: "1px solid var(--mantine-color-gray-3)" }}>
            <iframe ref={iref} title="daily-pdf-html" srcDoc={pdfHtml} onLoad={fit}
              style={{ width: A4_W, height: 1400, border: 0, background: "#fff", display: "block" }} />
          </Box>
          <Text size="xs" c="dimmed" maw={A4_W}>※ 차트는 웹 recharts 를 html-to-image 로 PNG 캡처 → PDF 임베드(웹과 픽셀 동일). 백엔드 차트엔진 불필요.</Text>
        </Stack>
      </Group>
    </>
  );
}
