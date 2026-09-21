import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "rgb(var(--color-canvas) / <alpha-value>)",
          soft: "rgb(var(--color-canvas-soft) / <alpha-value>)",
        },
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "#120F17",
        flash: {
          DEFAULT: "#FFE07D",
          dim: "#B89A4F",
        },
        curtain: {
          DEFAULT: "#FF6F91",
          soft: "#FF8FA8",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.45)",
        glow: "0 0 40px rgba(255, 224, 125, 0.25)",
      },
      backdropBlur: {
        glass: "20px",
      },
      keyframes: {
        flashPop: {
          "0%": { opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        sprocketFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
      },
      animation: {
        flashPop: "flashPop 0.5s ease-out",
        sprocketFloat: "sprocketFloat 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;