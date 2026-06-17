import React from "react";
import ReactDOM from "react-dom/client";

// index.css 가 먼저 와야 @layer mantine 선언이 확정됨(비레이어드 전역 규칙이 Mantine 위 우선).
import "./index.css";
// Mantine 스타일은 레이어 버전으로 임포트 → @layer mantine 에 적재.
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
import { DashboardProvider } from "./renew/DashboardProvider";
import { RenewRoot } from "./renew/RenewRoot";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: "ko", firstDayOfWeek: 0 }}>
        <ModalsProvider>
          <Notifications position="top-right" />
          <DashboardProvider>
            <RenewRoot />
          </DashboardProvider>
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>
);
