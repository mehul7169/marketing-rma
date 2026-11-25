export type PeriodDelta = {
  direction: "up" | "down" | "flat";
  pct: number;
  label: string;
};

/** Hide when the prior period is empty so we don't invent a %. */
export function periodDelta(
  current: number,
  prior: number
): PeriodDelta | null {
  if (prior <= 0) return null;
  const pct = Math.round(((current - prior) / prior) * 100);
  const direction: PeriodDelta["direction"] =
    pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { direction, pct, label: `${Math.abs(pct)}%` };
}
