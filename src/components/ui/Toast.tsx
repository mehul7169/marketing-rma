"use client";

import { useEffect, useState } from "react";

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
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          data-testid={`toast-${t.tone}`}
          className={`pointer-events-auto rounded border px-4 py-3 text-sm shadow-lg ${
            t.tone === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <div className="flex items-start gap-3">
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              className={
                t.tone === "error"
                  ? "text-red-700 hover:text-red-900"
                  : "text-emerald-700 hover:text-emerald-900"
              }
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
