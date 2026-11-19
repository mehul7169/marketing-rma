"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { toastError } from "@/components/ui/Toast";

export default function CopyValue({
  value,
  hoverReveal = false,
  label,
  kind
}: {
  value: string | null | undefined;
  hoverReveal?: boolean;
  /** Accessible name, e.g. "Copy phone number". */
  label?: string;
  kind?: "email" | "phone";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = (value ?? "").trim();

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const actionLabel =
    label ?? (kind === "phone" ? "Copy phone number" : kind === "email" ? "Copy email" : "Copy");
  const testId = kind === "phone" ? "copy-phone" : kind === "email" ? "copy-email" : "copy-value";

  if (!text) return null;

  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toastError("Couldn't copy — select and copy manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={copied ? "Copied" : actionLabel}
      title={copied ? "Copied" : actionLabel}
      data-testid={testId}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600 ${
        hoverReveal
          ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
          : ""
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="h-3.5 w-3.5">
      <rect
        x="5.5"
        y="5.5"
        width="8"
        height="8"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M10.5 5.5V4.25A1.25 1.25 0 0 0 9.25 3h-5A1.25 1.25 0 0 0 3 4.25v5A1.25 1.25 0 0 0 4.25 10.5H5.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="h-3.5 w-3.5">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
