"use client";

import { useEffect } from "react";

export default function WorkQueueToast({
  message,
  onDismiss,
  tone = "error"
}: {
  message: string | null;
  onDismiss: () => void;
  tone?: "error" | "success";
}) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`fixed bottom-4 right-4 z-[60] max-w-sm rounded border px-4 py-3 text-sm shadow-lg ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1">{message}</p>
        <button
          type="button"
          className={
            tone === "error"
              ? "text-red-700 hover:text-red-900"
              : "text-emerald-700 hover:text-emerald-900"
          }
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
