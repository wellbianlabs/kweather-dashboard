// 일일 보고서 리디자인 2칼럼 워크스페이스 (독립 URL /report-studio.html).
// 좌: 실 WebReport(프론트, 샘플 DailyReport) · 우: PDF 생성전 HTML(iframe, A4 폭, xhtml2pdf 호환).
// 좌측 변경 → ReportPanel.tsx 반영 / 우측 변경 → dailyReportHtml.ts(→ backend report.py Jinja2 포팅).
import { useRef } from "react";
import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import { WebReport } from "../components/ReportPanel";
import { SAMPLE_DAILY, SAMPLE_PDF, SAMPLE_SN } from "./reportSample";
import { renderDailyReportHtml } from "./dailyReportHtml";

const A4_W = 794; // 210mm @ 96dpi

export function ReportStudio() {
  const pdfHtml = renderDailyReportHtml(SAMPLE_PDF, { previewMargins: true });
  const iref = useRef<HTMLIFrameElement>(null);

  const fit = () => {
    const f = iref.current;
    try {
      const doc = f?.contentWindow?.document;
      if (doc) f!.style.height = `${doc.body.scrollHeight + 8}px`;
    } catch { /* noop */ }
  };

  return (
    <Group align="flex-start" gap="xl" wrap="nowrap" style={{ minWidth: "min-content" }}>
      {/* 좌: 웹 보고서 */}
      <Stack gap={8} style={{ flex: 1, minWidth: 460 }}>
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color="kw" radius="sm">웹 보고서</Badge>
          <Text size="xs" c="dimmed" truncate>src/components/ReportPanel.tsx · WebReport (실 컴포넌트)</Text>
        </Group>
        <WebReport report={SAMPLE_DAILY} deviceSn={SAMPLE_SN} />
      </Stack>

      {/* 우: PDF 생성전 HTML (A4) */}
      <Stack gap={8} style={{ flexShrink: 0, width: A4_W }}>
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color="grape" radius="sm">PDF 생성전 HTML</Badge>
          <Text size="xs" c="dimmed" truncate>backend report.py · _DAILY_TEMPLATE (xhtml2pdf · A4)</Text>
        </Group>
        <Box style={{ width: A4_W, background: "#fff", boxShadow: "0 2px 14px rgba(15,23,42,0.13)", border: "1px solid var(--mantine-color-gray-3)" }}>
          <iframe
            ref={iref}
            title="daily-pdf-html"
            srcDoc={pdfHtml}
            onLoad={fit}
            style={{ width: A4_W, height: 1400, border: 0, background: "#fff", display: "block" }}
          />
        </Box>
        <Text size="xs" c="dimmed" maw={A4_W}>※ A4 폭 미리보기(브라우저 렌더). 실제 PDF는 xhtml2pdf + 서버 렌더 PNG 차트 — 차트 영역은 플레이스홀더로 표시.</Text>
      </Stack>
    </Group>
  );
}
