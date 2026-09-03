import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: {
            900: "var(--brand-navy-900)",
            700: "var(--brand-navy-700)"
          },
          accent: {
            600: "var(--brand-accent-600)",
            500: "var(--brand-accent-500)"
          }
        }
      }
    }
  },
  plugins: []
};

export default config;
