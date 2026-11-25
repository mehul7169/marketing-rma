"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const keyFor = (orgId: string) => `deals-triage-dismissed:${orgId}`;

export default function TriageBanner({
  orgId,
  count
}: {
  orgId: string;
  count: number;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(keyFor(orgId)) === "1");
    } catch {
      setHidden(false);
    }
  }, [orgId]);

  if (count <= 0 || hidden) return null;

  return (
    <div
      data-testid="deals-triage-banner"
      className="flex items-center gap-3 rounded border border-warning-soft bg-warning-soft px-3 py-2 text-sm text-warning"
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => router.push("/deals?metric=needs_next_step")}
      >
        {count} deal{count === 1 ? "" : "s"} need a next step. Set them now.
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded px-2 py-0.5 text-xs text-warning hover:bg-warning-soft"
        onClick={() => {
          try {
            window.localStorage.setItem(keyFor(orgId), "1");
          } catch {
            // ignore
          }
          setHidden(true);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
