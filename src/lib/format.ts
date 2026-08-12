export const CURRENCY = "INR" as const;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const inrAxisFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
  notation: "compact",
  compactDisplay: "short"
});

/** e.g. ₹68,255 */
export function formatCurrency(value: number): string {
  return inrFormatter.format(value);
}

/** Compact INR for chart y-axis ticks (e.g. ₹6.8K, ₹1.2L). */
export function formatCurrencyAxis(value: number): string {
  return inrAxisFormatter.format(value);
}

export function formatCurrencyNullable(value: number | null): string {
  if (value === null) return "—";
  return formatCurrency(value);
}

/** Integer with Indian digit grouping — e.g. 9,322 */
export function formatInteger(value: number): string {
  return value.toLocaleString("en-IN");
}

/** Percentage rounded to 2 decimal places — e.g. 3.45% */
export function formatPercent(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`;
}

export function formatPercentNullable(value: number | null): string {
  if (value === null) return "—";
  return formatPercent(value);
}

/** Period-over-period change subtext, e.g. "↑ 12% vs prior 30 days". */
export function formatPeriodComparison(
  current: number,
  prior: number,
  periodDays: number
): string | null {
  if (prior <= 0) return null;
  if (current === 0 && prior === 0) return null;

  const changePct = ((current - prior) / prior) * 100;
  const arrow = changePct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(changePct).toFixed(0)}% vs prior ${periodDays} days`;
}
