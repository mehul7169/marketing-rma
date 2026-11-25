"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION_OFF, transitionBase, transitionReduced } from "@/lib/motion";

export type ToastTone = "error" | "success";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

const ERROR_MS = 4000;
const SUCCESS_MS = 3000;
const MAX_STACK = 3;

type Listener = (items: ToastItem[]) => void;
let nextId = 1;
let stack: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(stack);
}

function pushToast(message: string, tone: ToastTone): number {
  const id = nextId++;
  stack = [...stack, { id, message, tone }].slice(-MAX_STACK);
  emit();
  const ms = tone === "error" ? ERROR_MS : SUCCESS_MS;
  window.setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number) {
  const next = stack.filter((t) => t.id !== id);
  if (next.length === stack.length) return;
  stack = next;
  emit();
}

export function toastError(message: string): number {
  return pushToast(message, "error");
}

export function toastSuccess(message: string): number {
  return pushToast(message, "success");
}

/** Test-only: empty the stack. */
export function resetToasts() {
  stack = [];
  emit();
}

export function Toaster() {
  const reduced = useReducedMotion();
  const [items, setItems] = useState<ToastItem[]>(stack);

  useEffect(() => {
    listeners.add(setItems);
    setItems(stack);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-[80] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      data-testid="toast-stack"
    >
      {items.map((t) => (
        <motion.div
          key={t.id}
          layout={!MOTION_OFF}
          initial={
            MOTION_OFF
              ? false
              : reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 16 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? transitionReduced : transitionBase}
          role={t.tone === "error" ? "alert" : "status"}
          data-testid={`toast-${t.tone}`}
          className={`pointer-events-auto rounded-control border px-4 py-3 text-sm shadow-card ${
            t.tone === "error"
              ? "border-danger-soft bg-danger-soft text-danger"
              : "border-success-soft bg-success-soft text-success"
          }`}
        >
          <div className="flex items-start gap-3">
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              className={
                t.tone === "error"
                  ? "text-danger hover:opacity-80"
                  : "text-success hover:opacity-80"
              }
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
