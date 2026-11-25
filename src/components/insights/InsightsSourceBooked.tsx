"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SourceBookedRow } from "@/lib/insights/metrics";
import { formatInteger } from "@/lib/format";
import CountUp from "@/components/ui/CountUp";
import { MOTION_OFF, transitionSlow } from "@/lib/motion";

export default function InsightsSourceBooked({ rows }: { rows: SourceBookedRow[] }) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || reduced;
  const max = rows.reduce((m, r) => Math.max(m, r.callsBooked), 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">No booked calls in this range.</p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? (row.callsBooked / max) * 100 : 0;
        return (
          <div key={row.source}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-fg">{row.source}</span>
              <span className="tabular-nums text-fg">
                <CountUp value={row.callsBooked} format={formatInteger} />
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-surface-2">
              <motion.div
                className="h-2 origin-left rounded-pill bg-accent"
                style={{ width: `${width}%` }}
                initial={skip ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={skip ? { duration: 0 } : transitionSlow}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
