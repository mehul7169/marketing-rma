"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { MOTION_OFF, transitionSlow } from "@/lib/motion";

export default function ProgressRing({
  value,
  target = 100,
  label,
  size = 88,
  className
}: {
  value: number;
  target?: number;
  label?: string;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || reduced;
  const pct = target <= 0 ? 0 : Math.max(0, Math.min(1, value / target));
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const display = `${Math.round(pct * 100)}%`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={skip ? false : { pathLength: 0 }}
          animate={{ pathLength: pct }}
          transition={skip ? { duration: 0 } : transitionSlow}
          strokeDasharray={c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-fg">{display}</span>
        {label ? <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span> : null}
      </div>
      <span className="sr-only">
        {value} of {target}
        {label ? ` ${label}` : ""}
      </span>
    </div>
  );
}
