"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { MOTION_OFF, transitionSlow } from "@/lib/motion";

export default function FunnelBar({
  paid,
  organic,
  valueLabel,
  conversionLabel,
  className
}: {
  paid: number;
  organic: number;
  valueLabel: string;
  conversionLabel?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || reduced;
  const total = paid + organic;
  const paidPct = total <= 0 ? 0 : (paid / total) * 100;
  const orgPct = total <= 0 ? 0 : 100 - paidPct;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-3">
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
        <div className="mt-1 text-xs text-muted">{conversionLabel}</div>
      ) : null}
    </div>
  );
}
