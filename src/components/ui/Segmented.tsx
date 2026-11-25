"use client";

import { useCallback, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { MOTION_OFF, transitionBase } from "@/lib/motion";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: string;
};

export default function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const reduced = useReducedMotion();
  const skipLayout = MOTION_OFF || reduced;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  const move = useCallback(
    (dir: number) => {
      if (options.length === 0) return;
      const next = (index + dir + options.length) % options.length;
      onChange(options[next]!.value);
    },
    [index, onChange, options]
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(options[0]!.value);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(options[options.length - 1]!.value);
    }
  }

  const layoutId = `segmented-${ariaLabel}`;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-pill bg-surface-2 p-1"
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative rounded-pill px-3 py-1 text-xs font-medium",
              selected ? "text-accent-fg" : "text-muted hover:text-fg"
            )}
          >
            {selected ? (
              skipLayout ? (
                <span
                  className="absolute inset-0 rounded-pill bg-accent"
                  aria-hidden
                />
              ) : (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-pill bg-accent"
                  transition={transitionBase}
                  aria-hidden
                />
              )
            ) : null}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
