import React from "react";
import ReactDOM from "react-dom/client";

// index.css 가 먼저 와야 @layer 순서(tailwind-base < mantine < tailwind-utilities)가 확정됨.
import "./index.css";
// Mantine 스타일은 레이어 버전으로 임포트 → @layer mantine 에 적재(전환기 Tailwind 공존).
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import "@mantine/dropzone/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/charts/styles.layer.css";

import "dayjs/locale/ko";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";

import { theme } from "./theme";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: "ko", firstDayOfWeek: 0 }}>
        <ModalsProvider>
          <Notifications position="top-right" />
          <App />
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>
);
