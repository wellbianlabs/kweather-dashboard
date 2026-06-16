import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/charts/styles.layer.css";

import { MantineProvider } from "@mantine/core";
import { theme } from "./theme";
import { DashboardMockup } from "./mockup/DashboardMockup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DashboardMockup />
    </MantineProvider>
  </React.StrictMode>
);
