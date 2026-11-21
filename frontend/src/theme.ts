// 케이웨더 브랜드 토큰을 Mantine 테마로 이식.
// - Tailwind(tailwind.config.js)의 kw 네이비/스카이·shadow·radius·Pretendard 와 일치시킴.
// - primaryColor=kw, primaryShade=6 → 채움 버튼이 브랜드 네이비(#0f499e)로 렌더.
import { createTheme, type MantineColorsTuple } from "@mantine/core";

// 케이웨더 네이비(#0f499e, 로고) 기준 10단계 — index 6 = 브랜드 기본색
const kw: MantineColorsTuple = [
  "#eef4fb", // 0 (Tailwind kw-50)
  "#dbe7f7", // 1 (kw-100)
  "#b3cbe9", // 2
  "#88abd8", // 3
  "#6790ca", // 4
  "#517fc1", // 5
  "#0f499e", // 6 ★ DEFAULT (브랜드 네이비)
  "#0d4290", // 7 (hover)
  "#0c3d85", // 8 (kw-dark)
  "#082f68", // 9
];

// 심볼 웨이브 블루(#1790cd) — 보조 강조색
const sky: MantineColorsTuple = [
  "#e7f5fc", "#cfe9f7", "#9fd2ef", "#6bbae8", "#43a7e1",
  "#2a9bdd", "#1790cd", "#0a7fb8", "#0070a4", "#005c88",
];

const FONT =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif';

export const theme = createTheme({
  primaryColor: "kw",
  primaryShade: { light: 6, dark: 6 },
  colors: { kw, sky },
  fontFamily: FONT,
  headings: { fontFamily: FONT, fontWeight: "700" },
  defaultRadius: "md",
  // Tailwind rounded-xl/2xl 감성으로 라운드 스케일 보정
  radius: { xs: "0.375rem", sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.25rem" },
  // Tailwind shadow-card / shadow-lift 이식
  shadows: {
    xs: "0 1px 2px rgba(15,23,42,.04)",
    sm: "0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.04)", // = shadow-card
    md: "0 2px 4px rgba(15,23,42,.05), 0 12px 32px rgba(15,23,42,.08)", // = shadow-lift
  },
});
