"use client";

import Spinner from "@/components/ui/Spinner";

/**
 * Inline async status for optimistic saves — spinner while confirming,
 * brief check on success, nothing on idle. Errors stay with toast/rollback.
 */
export default function AsyncStatusIndicator({
  status
}: {
  status: "idle" | "saving" | "saved";
}) {
  if (status === "idle") return null;

  if (status === "saving") {
    return <Spinner size="xs" label="Saving" />;
  }

  return (
    <span
      role="status"
      aria-label="Saved"
      className="inline-flex h-3.5 w-3.5 items-center justify-center text-emerald-600"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
