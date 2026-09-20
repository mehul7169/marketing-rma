"use client";

import { useEffect } from "react";

export default function WorkQueueToast({
  message,
  onDismiss
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[60] max-w-sm rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1">{message}</p>
        <button
          type="button"
          className="text-red-700 hover:text-red-900"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
