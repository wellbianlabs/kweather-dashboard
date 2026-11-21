// 독립 URL 엔트리 — 일일 보고서 리디자인 스튜디오 (catalog-canvas 스코프 없이 실 테마·풀페이지).
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/charts/styles.layer.css";

import "dayjs/locale/ko";
import { Badge, Box, Group, MantineProvider, Text } from "@mantine/core";
import { theme } from "./theme";
import { ReportStudio } from "./catalog/ReportStudio";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light" classNamesPrefix="kw-dash">
      <Box style={{ minHeight: "100vh", background: "var(--mantine-color-gray-0)" }}>
        <Box
          component="header"
          px="lg"
          py="sm"
          style={{
            position: "sticky", top: 0, zIndex: 10,
            background: "var(--mantine-color-white)",
            borderBottom: "1px solid var(--mantine-color-gray-2)",
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <img src="/kweather-logo.png" alt="KW" style={{ height: 20 }} />
              <Text fw={700} fz="sm">일일 보고서 리디자인 스튜디오</Text>
              <Badge variant="light" color="gray" size="sm">웹 ↔ PDF 생성전 HTML</Badge>
            </Group>
            <Text size="xs" c="dimmed" visibleFrom="sm">
              좌=ReportPanel WebReport · 우=catalog/dailyReportHtml.ts → backend Jinja2
            </Text>
          </Group>
        </Box>
        <Box p="lg" style={{ overflowX: "auto" }}>
          <ReportStudio />
        </Box>
      </Box>
    </MantineProvider>
  </React.StrictMode>
);
