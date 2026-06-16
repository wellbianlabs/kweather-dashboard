// 멀티디바이스 PDF 뷰어 — react-pdf(pdf.js 캔버스). iOS/안드로이드/데스크톱 일관 렌더.
// 인증 게이트 blob 입력 · 반응형 width · 줌/페이지 · 모바일 폴백(새 탭). Mantine 툴바.
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ActionIcon, Box, Group, Loader, Text, Tooltip } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconChevronLeft, IconChevronRight, IconDownload, IconExternalLink, IconZoomIn, IconZoomOut,
} from "@tabler/icons-react";

// Vite: 워커를 import.meta.url 로 해석 → 별도 청크로 emit(메인 번들 비대화 방지)
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function PdfViewer({
  file,
  url,
  height = 720,
  onDownload,
}: { file: Blob | string; url?: string; height?: number; onDownload?: () => void }) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const { ref, width } = useElementSize();
  const pageWidth = Math.max(280, Math.floor((width || 640) * scale) - 24);

  return (
    <Box>
      {/* 툴바 */}
      <Group justify="space-between" px="xs" py={6}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", background: "var(--mantine-color-default-hover)" }}>
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="prev">
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text size="xs" w={62} ta="center">{page} / {numPages || "–"}</Text>
          <ActionIcon variant="subtle" color="gray" disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))} aria-label="next">
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" onClick={() => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(2)))} aria-label="zoom-out">
            <IconZoomOut size={16} />
          </ActionIcon>
          <Text size="xs" w={42} ta="center">{Math.round(scale * 100)}%</Text>
          <ActionIcon variant="subtle" color="gray" onClick={() => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(2)))} aria-label="zoom-in">
            <IconZoomIn size={16} />
          </ActionIcon>
          {url && (
            <Tooltip label="새 탭으로 열기 (모바일 권장)">
              <ActionIcon variant="subtle" color="gray" onClick={() => window.open(url, "_blank", "noopener")} aria-label="open-tab">
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {onDownload && (
            <ActionIcon variant="subtle" color="gray" onClick={onDownload} aria-label="download">
              <IconDownload size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* 문서 */}
      <Box ref={ref} style={{ height, overflow: "auto", display: "flex", justifyContent: "center", background: "var(--mantine-color-gray-1)", padding: 12 }}>
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPage(1); }}
          loading={<Box style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><Loader /></Box>}
          error={<Text c="dimmed" mt="xl">PDF를 표시하지 못했습니다. 우측 상단 “새 탭/다운로드”로 확인하세요.</Text>}
        >
          <Page pageNumber={page} width={pageWidth} renderTextLayer renderAnnotationLayer loading={<Loader size="sm" mt="xl" />} />
        </Document>
      </Box>
    </Box>
  );
}
