"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { MOTION_OFF, transitionBase } from "@/lib/motion";

/** Presentational slide-over shell. Callers own open/close behaviour. */
export default function Drawer({
  open,
  onClose,
  labelledBy,
  widthClass = "w-full max-w-md",
  children
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  widthClass?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || reduced;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.button
        type="button"
        className="absolute inset-0 bg-overlay"
        aria-label="Close"
        onClick={onClose}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transitionBase}
      />
      <aside
        className={cn(
          "relative flex h-full flex-col overflow-hidden border-l border-subtle bg-surface shadow-card",
          widthClass
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <motion.div
          className="flex h-full flex-col overflow-y-auto"
          initial={skip ? false : { x: "100%" }}
          animate={{ x: 0 }}
          transition={transitionBase}
        >
          {children}
        </motion.div>
      </aside>
    </div>
  );
}
