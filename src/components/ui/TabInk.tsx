"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_OFF, transitionBase } from "@/lib/motion";

export default function TabInk({
  active,
  layoutId
}: {
  active: boolean;
  layoutId: string;
}) {
  const reduced = useReducedMotion();
  if (!active) return null;
  if (MOTION_OFF || reduced) {
    return (
      <span
        className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-fg"
        aria-hidden
      />
    );
  }
  return (
    <motion.span
      layoutId={layoutId}
      className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-fg"
      transition={transitionBase}
      aria-hidden
    />
  );
}
