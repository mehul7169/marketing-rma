import { inclusiveDayCount } from "@/lib/utils/date";
import { formatInrCompact } from "@/lib/format";
import { istMonthEnd, istMonthStart } from "@/lib/home/range";

export type PaceStatus = "ahead" | "behind";

export type RevenuePace = {
  revenue: number;
  goal: number;
  pct: number;
  expected: number;
  remaining: number;
  daysElapsed: number;
  daysInMonth: number;
  daysLeft: number;
  perDay: number;
  status: PaceStatus;
  paceLine: string;
};

/**
 * Linear pace vs calendar month (IST). Days elapsed and days left both
 * include today. Remaining is floored at 0 when the goal is already hit.
 */
export function revenuePace(input: {
  revenue: number;
  goal: number;
  todayISO: string;
  monthStart?: string;
  monthEnd?: string;
}): RevenuePace {
  const monthStart = input.monthStart ?? istMonthStart(input.todayISO);
  const monthEnd = input.monthEnd ?? istMonthEnd(input.todayISO);
  const daysInMonth = inclusiveDayCount(monthStart, monthEnd);
  const daysElapsed = Math.min(
    daysInMonth,
    Math.max(1, inclusiveDayCount(monthStart, input.todayISO))
  );
  const daysLeft = Math.max(1, inclusiveDayCount(input.todayISO, monthEnd));
  const expected = input.goal <= 0 ? 0 : (input.goal * daysElapsed) / daysInMonth;
  const remaining = Math.max(0, input.goal - input.revenue);
  const perDay = remaining / daysLeft;
  const pct = input.goal <= 0 ? 0 : input.revenue / input.goal;
  const status: PaceStatus = input.revenue >= expected ? "ahead" : "behind";
  const paceLine = `${formatInrCompact(remaining)} to go in ${daysLeft} day${
    daysLeft === 1 ? "" : "s"
  }, about ${formatInrCompact(perDay)} a day`;
  return {
    revenue: input.revenue,
    goal: input.goal,
    pct,
    expected,
    remaining,
    daysElapsed,
    daysInMonth,
    daysLeft,
    perDay,
    status,
    paceLine
  };
}
