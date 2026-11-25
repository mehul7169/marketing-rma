/**
 * Chart colours from CSS variables so Recharts follow the active theme.
 * Fallbacks are the light tokens (SSR / first paint).
 */

export type ChartTheme = {
  grid: string;
  axis: string;
  series1: string;
  series2: string;
  tooltipBg: string;
  tooltipFg: string;
  tooltipBorder: string;
};

const LIGHT_FALLBACK: ChartTheme = {
  grid: "rgba(0, 0, 0, 0.08)",
  axis: "#6B6B70",
  series1: "#B8F04A",
  series2: "#8A9A92",
  tooltipBg: "#F0F0EE",
  tooltipFg: "#111113",
  tooltipBorder: "rgba(0, 0, 0, 0.08)"
};

function readVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

export function readChartTheme(root?: Element | null): ChartTheme {
  const el =
    root ??
    (typeof document === "undefined" ? null : document.documentElement);
  if (!el || typeof getComputedStyle === "undefined") return LIGHT_FALLBACK;
  return {
    grid: readVar(el, "--border", LIGHT_FALLBACK.grid),
    axis: readVar(el, "--text-muted", LIGHT_FALLBACK.axis),
    series1: readVar(el, "--accent", LIGHT_FALLBACK.series1),
    series2: readVar(el, "--neutral-series", LIGHT_FALLBACK.series2),
    tooltipBg: readVar(el, "--surface-2", LIGHT_FALLBACK.tooltipBg),
    tooltipFg: readVar(el, "--text", LIGHT_FALLBACK.tooltipFg),
    tooltipBorder: readVar(el, "--border", LIGHT_FALLBACK.tooltipBorder)
  };
}

export const chartThemeFallback = LIGHT_FALLBACK;
