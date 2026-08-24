import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cada color resuelve a una variable CSS (ver globals.css), así que
        // cambia solo con cambiar :root[data-theme] — sin tocar componentes.
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        accentInk: "rgb(var(--accent-ink) / <alpha-value>)",
        accent2: "rgb(var(--accent2) / <alpha-value>)",
        accent3: "rgb(var(--accent3) / <alpha-value>)",
        status: {
          todo: "rgb(var(--status-todo) / <alpha-value>)",
          progress: "rgb(var(--status-progress) / <alpha-value>)",
          review: "rgb(var(--status-review) / <alpha-value>)",
          done: "rgb(var(--status-done) / <alpha-value>)",
        },
      },
      fontFamily: {
        heading: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        body: ["var(--font-ibm-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
