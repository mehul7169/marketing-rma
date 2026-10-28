"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { makeLatestWins } from "@/lib/leads/latestWins";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Draft search box bound to a URL value. Typing debounces a commit;
 * Enter commits immediately and cancels the pending timer.
 * `onCommit` is skipped when the trimmed draft already matches the URL,
 * and stale commits (an older debounce firing after a newer one) are dropped.
 */
export function useFilterSearch({
  urlValue,
  onCommit,
  debounceMs = SEARCH_DEBOUNCE_MS
}: {
  urlValue: string;
  onCommit: (
    next: string,
    meta: { isLatest: () => boolean; seq: number; immediate: boolean }
  ) => void;
  debounceMs?: number;
}) {
  const [draft, setDraft] = useState(urlValue);
  const timer = useRef<number | null>(null);
  const wins = useRef(makeLatestWins());
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const urlRef = useRef(urlValue);
  urlRef.current = urlValue;
  const draftRef = useRef(draft);
  const inflight = useRef<string | null>(null);

  useEffect(() => {
    setDraft(urlValue);
    draftRef.current = urlValue;
    inflight.current = null;
  }, [urlValue]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback((raw: string, immediate: boolean) => {
    const next = raw.trim();
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (next === urlRef.current.trim()) return;
    if (next === inflight.current) return;
    inflight.current = next;
    const seq = wins.current.begin();
    onCommitRef.current(next, {
      seq,
      immediate,
      isLatest: () => wins.current.isLatest(seq)
    });
  }, []);

  const onChange = useCallback(
    (value: string) => {
      draftRef.current = value;
      setDraft(value);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        flush(draftRef.current, false);
      }, debounceMs);
    },
    [debounceMs, flush]
  );

  const onEnter = useCallback(() => {
    flush(draftRef.current, true);
  }, [flush]);

  return {
    draft,
    onChange,
    onEnter
  };
}
