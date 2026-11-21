import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 시 /api 요청을 FastAPI(8000)로 프록시. 빌드 결과는 백엔드가 직접 서빙 가능.
export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      // CSS 모듈 클래스 네임스페이스를 kw-dash 로 통일(브랜딩).
      // Mantine 안정 셀렉터(mantine-*)는 MantineProvider classNamesPrefix="kw-dash" 로 별도 처리.
      generateScopedName: "kw-dash-[local]-[hash:base64:5]",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
