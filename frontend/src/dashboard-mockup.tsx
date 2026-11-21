// 독립 URL 엔트리 — 대시보드 목업 프로토타입(협의용). 실 테마·풀페이지.
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import "@mantine/core/styles.layer.css";
import "@mantine/charts/styles.layer.css";

import { MantineProvider } from "@mantine/core";
import { theme } from "./theme";
import { DashboardMockup } from "./catalog/DashboardMockup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light" classNamesPrefix="kw-dash">
      <DashboardMockup />
    </MantineProvider>
  </React.StrictMode>
);
