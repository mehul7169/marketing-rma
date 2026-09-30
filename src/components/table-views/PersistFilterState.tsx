"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/** Remembers the current URL filters as this user's last-used state for the page. */
export default function PersistFilterState({ pageKey }: { pageKey: string }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const lastSent = useRef<string | null>(null);
  // Serialize saves so a slow earlier request can't overwrite a newer state.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!search || search === lastSent.current) return;
    lastSent.current = search;
    chain.current = chain.current.then(() =>
      fetch(`/api/table-views/${encodeURIComponent(pageKey)}/filters`, {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search })
      }).catch(() => {
        if (lastSent.current === search) lastSent.current = null;
      })
    );
  }, [pageKey, search]);

  return null;
}
