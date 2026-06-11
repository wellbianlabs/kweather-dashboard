/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Pretendard Variable"', "Pretendard", "-apple-system", "BlinkMacSystemFont",
          '"Segoe UI"', "Roboto", '"Malgun Gothic"', "sans-serif",
        ],
      },
      colors: {
        kw: {
          DEFAULT: "#0f499e",   // 케이웨더 네이비 (로고)
          dark: "#0c3d85",
          sky: "#1790cd",       // 심볼 웨이브 블루
          50: "#eef4fb",
          100: "#dbe7f7",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)",
        lift: "0 2px 4px rgba(15, 23, 42, 0.05), 0 12px 32px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
