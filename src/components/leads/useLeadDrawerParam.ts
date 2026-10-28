"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { withLeadParam } from "@/lib/leads/leadHref";

/**
 * Drawer open/close is client state. The URL is synced with history.pushState
 * (open) / replaceState (close) so Next 14.1+ updates useSearchParams without
 * refetching server components.
 */
type Listener = () => void;

let openLeadId: string | null | undefined;
/** Last lead id we wrote to the URL, so a lagging useSearchParams can't revert us. */
let lastWritten: string | null | undefined;
const listeners = new Set<Listener>();

function readUrlLead(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("lead");
}

function emit() {
  for (const l of listeners) l();
}

function getOpenLeadId(fallback: string | null = null): string | null {
  if (openLeadId === undefined) {
    openLeadId = fallback ?? readUrlLead();
    lastWritten = openLeadId;
  }
  return openLeadId;
}

function setOpenLeadId(id: string | null) {
  if (openLeadId === id) return;
  openLeadId = id;
  emit();
}

function syncUrl(id: string | null, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  lastWritten = id;
  const href = withLeadParam(
    window.location.pathname,
    window.location.search,
    id
  );
  const next = href || window.location.pathname;
  if (mode === "push") {
    window.history.pushState(window.history.state, "", next);
  } else {
    window.history.replaceState(window.history.state, "", next);
  }
}

/** Test-only. */
export function resetLeadDrawer() {
  openLeadId = null;
  lastWritten = null;
  emit();
}

export function useLeadDrawerParam() {
  const search = useSearchParams();
  const urlLead = search.get("lead");
  const [leadId, setLeadId] = useState<string | null>(() =>
    getOpenLeadId(urlLead)
  );

  useEffect(() => {
    const onStore = () => setLeadId(getOpenLeadId());
    listeners.add(onStore);
    onStore();
    return () => {
      listeners.delete(onStore);
    };
  }, []);

  // Follow real Next navigations (filters, deep link). Ignore stale snapshots
  // that still show the pre-pushState URL.
  useEffect(() => {
    if (urlLead === lastWritten) return;
    lastWritten = urlLead;
    setOpenLeadId(urlLead);
  }, [urlLead]);

  useEffect(() => {
    function onPop() {
      const id = readUrlLead();
      lastWritten = id;
      setOpenLeadId(id);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback((id: string) => {
    setOpenLeadId(id);
    syncUrl(id, "push");
  }, []);

  const close = useCallback(() => {
    setOpenLeadId(null);
    syncUrl(null, "replace");
  }, []);

  return { leadId, open, close };
}
