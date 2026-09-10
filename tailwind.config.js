/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/src/**/*.{ts,tsx}",
    "./src/renderer/index.html",
    "./website/**/*.{ts,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        copilot: {
          bg: "rgba(10, 10, 10, 0.85)",
          surface: "rgba(20, 20, 20, 0.9)",
          accent: "#00E5A0",
          muted: "#6B7280",
          text: "#F9FAFB",
          dim: "#9CA3AF",
          border: "rgba(255, 255, 255, 0.06)",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
