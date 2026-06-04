import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 시 /api 요청을 FastAPI(8000)로 프록시. 빌드 결과는 백엔드가 직접 서빙 가능.
export default defineConfig({
  plugins: [react()],
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
