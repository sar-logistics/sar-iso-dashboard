import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pastel palette — white base with module accents
        sales: { DEFAULT: "#C7F0DB", dark: "#5BA37C", text: "#1F5C3F" },     // mint
        mr: { DEFAULT: "#FFE5D0", dark: "#D98C5A", text: "#7A3B16" },        // peach
        finance: { DEFAULT: "#E8DFFF", dark: "#8E76D6", text: "#3D2B7C" },   // lavender
        warning: { DEFAULT: "#FFF1B8", dark: "#D6B23B", text: "#6B5418" },   // butter
        info: { DEFAULT: "#D4E9FF", dark: "#5A8FCC", text: "#1F4A7A" },      // sky
        ink: { primary: "#1E293B", secondary: "#475569", tertiary: "#94A3B8" },
        surface: { DEFAULT: "#FFFFFF", muted: "#F8FAFC", border: "#E2E8F0" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
