import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  safelist: [
    "bg-accent-green",
    "bg-accent-orange",
    "bg-accent-purple",
    "bg-accent-yellow",
    "bg-accent-blue",
    "bg-accent-pink",
    "bg-sales", "text-sales-text",
    "bg-mr", "text-mr-text",
    "bg-finance", "text-finance-text",
    "bg-info", "text-info-text",
    "bg-warning", "text-warning-text",
  ],
  theme: {
    extend: {
      colors: {
        sales: { DEFAULT: "#C7F0DB", dark: "#5BA37C", text: "#1F5C3F" },
        mr: { DEFAULT: "#FFE5D0", dark: "#D98C5A", text: "#7A3B16" },
        finance: { DEFAULT: "#E8DFFF", dark: "#8E76D6", text: "#3D2B7C" },
        warning: { DEFAULT: "#FFF1B8", dark: "#D6B23B", text: "#6B5418" },
        info: { DEFAULT: "#D4E9FF", dark: "#5A8FCC", text: "#1F4A7A" },

        accent: {
          green: "#22C55E",
          orange: "#F97316",
          purple: "#A855F7",
          yellow: "#F59E0B",
          blue: "#3B82F6",
          pink: "#EC4899",
        },

        ink: { primary: "#1E293B", secondary: "#475569", tertiary: "#94A3B8" },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F8FAFC",
          subtle: "#F1F5F9",
          border: "#E2E8F0",
        },
        positive: "#16A34A",
        negative: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
