"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { MOTION_OFF, transitionSlow } from "@/lib/motion";

export default function FunnelBar({
  paid,
  organic,
  valueLabel,
  conversionLabel,
  label,
  maxScale,
  className
}: {
  paid: number;
  organic: number;
  valueLabel: string;
  conversionLabel?: string;
  label?: string;
  /** Scale the stacked width against this total (Home: Leads). */
  maxScale?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || reduced;
  const total = paid + organic;
  const scale = maxScale && maxScale > 0 ? maxScale : total > 0 ? total : 1;
  const paidPct = Math.min(100, (paid / scale) * 100);
  const orgPct = Math.min(100 - paidPct, (organic / scale) * 100);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-3">
        {label ? (
          <div className="w-[5.5rem] shrink-0 text-sm text-fg sm:w-28">
            {label}
          </div>
        ) : null}
        <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2">
          <motion.span
            className="h-full origin-left bg-accent"
            initial={skip ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={skip ? { duration: 0 } : transitionSlow}
            style={{ width: `${paidPct}%` }}
          />
          <motion.span
            className="h-full origin-left bg-neutral-series"
            initial={skip ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={skip ? { duration: 0 } : transitionSlow}
            style={{ width: `${orgPct}%` }}
          />
        </div>
        <div className="shrink-0 text-sm font-semibold tabular-nums text-fg">
          {valueLabel}
        </div>
      </div>
      {conversionLabel ? (
        <div className={cn("mt-1 text-xs text-muted", label && "sm:pl-[7.75rem]")}>
          {conversionLabel}
        </div>
      ) : null}
    </div>
  );
}
