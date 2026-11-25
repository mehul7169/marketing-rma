/** WCAG 2.x relative-luminance contrast. AA body text is 4.5:1. */

function channel(n: number): number {
  const c = n / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const L1 = hexLum(a);
  const L2 = hexLum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

export const TOKEN_PAIRS: Array<{ name: string; fg: string; bg: string }> = [
  { name: "text on bg (light)", fg: "#111113", bg: "#F6F6F4" },
  { name: "text on surface (light)", fg: "#111113", bg: "#FFFFFF" },
  { name: "muted on bg (light)", fg: "#6B6B70", bg: "#F6F6F4" },
  { name: "muted on surface (light)", fg: "#6B6B70", bg: "#FFFFFF" },
  { name: "accent-fg on accent", fg: "#111113", bg: "#B8F04A" },
  { name: "accent-text on bg (light)", fg: "#4D7C0F", bg: "#F6F6F4" },
  { name: "accent-text on surface (light)", fg: "#4D7C0F", bg: "#FFFFFF" },
  { name: "success on bg (light)", fg: "#166534", bg: "#F6F6F4" },
  { name: "success on soft (light)", fg: "#166534", bg: "#E7F6EC" },
  { name: "warning on bg (light)", fg: "#92400E", bg: "#F6F6F4" },
  { name: "warning on soft (light)", fg: "#92400E", bg: "#FBF0DC" },
  { name: "danger on bg (light)", fg: "#B91C1C", bg: "#F6F6F4" },
  { name: "danger on soft (light)", fg: "#B91C1C", bg: "#FDECEC" },
  { name: "text on bg (dark)", fg: "#F4F4F5", bg: "#0B0B0C" },
  { name: "text on surface (dark)", fg: "#F4F4F5", bg: "#151517" },
  { name: "muted on bg (dark)", fg: "#9A9AA2", bg: "#0B0B0C" },
  { name: "muted on surface (dark)", fg: "#9A9AA2", bg: "#151517" },
  { name: "accent-text on bg (dark)", fg: "#C9F56E", bg: "#0B0B0C" },
  { name: "success on bg (dark)", fg: "#4ADE80", bg: "#0B0B0C" },
  { name: "warning on bg (dark)", fg: "#FBBF24", bg: "#0B0B0C" },
  { name: "danger on bg (dark)", fg: "#F87171", bg: "#0B0B0C" },
  { name: "success on surface (dark)", fg: "#4ADE80", bg: "#151517" },
  { name: "warning on surface (dark)", fg: "#FBBF24", bg: "#151517" },
  { name: "danger on surface (dark)", fg: "#F87171", bg: "#151517" },
  { name: "success on soft (dark)", fg: "#4ADE80", bg: "#13251A" },
  { name: "warning on soft (dark)", fg: "#FBBF24", bg: "#2A2110" },
  { name: "danger on soft (dark)", fg: "#F87171", bg: "#2A1414" },
  { name: "muted on surface-2 (dark)", fg: "#9A9AA2", bg: "#1C1C1F" },
  { name: "text on surface-2 (dark)", fg: "#F4F4F5", bg: "#1C1C1F" },
  { name: "danger-fg on danger (dark)", fg: "#111113", bg: "#F87171" }
];

/** Spec pair that misses AA — do not use accent-text on surface-2 in light. */
export const KNOWN_FAIL: { name: string; fg: string; bg: string } = {
  name: "accent-text on surface-2 (light)",
  fg: "#4D7C0F",
  bg: "#F0F0EE"
};
