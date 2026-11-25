import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        subtle: "var(--border)",
        fg: "var(--text)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        "accent-text": "var(--accent-text)",
        "accent-soft": "var(--accent-soft)",
        "neutral-series": "var(--neutral-series)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        "danger-fg": "var(--danger-fg)",
        overlay: "var(--overlay)"
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        pill: "var(--radius-pill)"
      },
      boxShadow: {
        card: "var(--shadow)"
      },
      spacing: {
        // 4px base is Tailwind's default; keep an explicit token alias.
        token: "var(--space)"
      },
      fontSize: {
        display: ["2.75rem", { lineHeight: "1.1", fontWeight: "700" }],
        kpi: ["1.875rem", { lineHeight: "1.15", fontWeight: "700" }],
        title: ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        label: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.08em", fontWeight: "500" }]
      }
    }
  },
  plugins: []
};

export default config;
