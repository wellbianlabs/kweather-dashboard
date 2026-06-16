// Mantine(postcss-preset-mantine) + Tailwind 공존.
// 전환기 동안 두 시스템을 함께 쓰되, 최종적으로는 Mantine 단일화 예정.
export default {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
    tailwindcss: {},
    autoprefixer: {},
  },
};
