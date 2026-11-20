"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { withDealParam } from "@/lib/leads/leadHref";

type Listener = () => void;

let openDealId: string | null | undefined;
let lastWritten: string | null | undefined;
const listeners = new Set<Listener>();

function readUrlDeal(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("deal");
}

function emit() {
  for (const l of listeners) l();
}

function getOpenDealId(fallback: string | null = null): string | null {
  if (openDealId === undefined) {
    openDealId = fallback ?? readUrlDeal();
    lastWritten = openDealId;
  }
  return openDealId;
}

function setOpenDealId(id: string | null) {
  if (openDealId === id) return;
  openDealId = id;
  emit();
}

function syncUrl(id: string | null, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  lastWritten = id;
  const href = withDealParam(
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
export function resetDealDrawer() {
  openDealId = null;
  lastWritten = null;
  emit();
}

export function useDealDrawerParam() {
  const search = useSearchParams();
  const urlDeal = search.get("deal");
  const [dealId, setDealId] = useState<string | null>(() =>
    getOpenDealId(urlDeal)
  );

  useEffect(() => {
    const onStore = () => setDealId(getOpenDealId());
    listeners.add(onStore);
    onStore();
    return () => {
      listeners.delete(onStore);
    };
  }, []);

  useEffect(() => {
    if (urlDeal === lastWritten) return;
    lastWritten = urlDeal;
    setOpenDealId(urlDeal);
  }, [urlDeal]);

  useEffect(() => {
    function onPop() {
      const id = readUrlDeal();
      lastWritten = id;
      setOpenDealId(id);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback((id: string) => {
    setOpenDealId(id);
    syncUrl(id, "push");
  }, []);

  const close = useCallback(() => {
    setOpenDealId(null);
    syncUrl(null, "replace");
  }, []);

  return { dealId, open, close };
}
