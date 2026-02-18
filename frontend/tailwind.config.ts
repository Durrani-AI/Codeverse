import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* ── Refined purple accent (inspired by Bending Spoons) ────────── */
        brand: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",  /* accent text */
          500: "#8b5cf6",  /* primary */
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        /* ── Deep-dark surfaces ────────────────────────────────────────── */
        surface: {
          DEFAULT:     "#08080d",  /* page background – near-black */
          alt:         "#0e0e14",  /* slightly lifted bg (navbar, sidebar) */
          card:        "#111118",  /* card / panel bg */
          "card-hover":"#18181f",
          input:       "#0c0c12",  /* input fields */
          border:      "#1e1e2a",  /* subtle border */
        },
        /* ── Semantic colours ──────────────────────────────────────────── */
        success: {
          DEFAULT: "#22c55e",
          light:   "rgba(34,197,94,0.10)",
        },
        danger: {
          DEFAULT: "#ef4444",
          light:   "rgba(239,68,68,0.10)",
        },
        warning: {
          DEFAULT: "#eab308",
          light:   "rgba(234,179,8,0.10)",
        },
        /* ── Text ──────────────────────────────────────────────────────── */
        foreground: {
          DEFAULT: "#e8e8ed",  /* primary text – crisp white-ish */
          muted:   "#71717a",  /* subdued descriptive text */
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "12px",
        sm:      "8px",
        xs:      "4px",
      },
      animation: {
        "fade-in":    "fadeIn 0.5s ease-out",
        "slide-up":   "slideUp 0.45s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        glow:         "glow 3s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%":   { boxShadow: "0 0 15px rgba(139,92,246,0.15)" },
          "100%": { boxShadow: "0 0 30px rgba(139,92,246,0.30)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
