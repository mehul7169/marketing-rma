"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultColumnsForPage } from "@/lib/table-views/registry";
import {
  mergeColumnsWithDefaults,
  type AvailableColumn,
  type TableColumnConfig,
  type TableViewBootstrap,
  type TableViewConfig
} from "@/lib/table-views/types";

const SAVE_DEBOUNCE_MS = 400;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type UseTableViewResult = {
  /** Ordered visible columns for rendering. */
  visibleColumns: TableColumnConfig[];
  /** Full ordered list (visible + hidden) for the picker. */
  columns: TableColumnConfig[];
  availableColumns: AvailableColumn[];
  labelFor: (id: string) => string;
  ready: boolean;
  saving: boolean;
  error: string | null;
  setColumnVisible: (id: string, visible: boolean) => void;
  setColumnWidth: (id: string, width: number) => void;
  moveColumn: (id: string, direction: "up" | "down") => void;
  reorderColumn: (fromId: string, toId: string) => void;
  resetToDefault: () => void;
};

export type UseTableViewOptions = {
  defaultColumns?: TableColumnConfig[];
  /**
   * Server-loaded config + available columns. When provided, first paint uses
   * these columns and skips the saved-config client fetch (no flash).
   */
  bootstrap?: TableViewBootstrap | null;
};

/**
 * Per-user table column preferences for a pageKey.
 * Prefer passing `bootstrap` from the server page load to avoid a defaults flash.
 */
export function useTableView(
  pageKey: string,
  options?: UseTableViewOptions | TableColumnConfig[]
): UseTableViewResult {
  // Back-compat: second arg used to be defaultColumns array.
  const opts: UseTableViewOptions = Array.isArray(options)
    ? { defaultColumns: options }
    : options ?? {};

  const defaults = useMemo(
    () =>
      (opts.defaultColumns?.length
        ? opts.defaultColumns
        : defaultColumnsForPage(pageKey)
      ).map((c) => ({ ...c })),
    [pageKey, opts.defaultColumns]
  );

  const hasBootstrap = Boolean(opts.bootstrap?.columns?.length);

  const [columns, setColumns] = useState<TableColumnConfig[]>(() =>
    hasBootstrap && opts.bootstrap
      ? opts.bootstrap.columns.map((c) => ({ ...c }))
      : defaults.map((c) => ({ ...c }))
  );
  const [availableColumns, setAvailableColumns] = useState<AvailableColumn[]>(
    () =>
      hasBootstrap && opts.bootstrap
        ? opts.bootstrap.availableColumns.map((c) => ({ ...c }))
        : []
  );
  const [ready, setReady] = useState(hasBootstrap);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequestId = useRef(0);
  const lastSavedJson = useRef<string | null>(
    hasBootstrap && opts.bootstrap
      ? JSON.stringify(opts.bootstrap.columns)
      : null
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const bootstrappedPageKey = useRef(
    hasBootstrap ? opts.bootstrap!.pageKey : null
  );

  const labelFor = useCallback(
    (id: string) => {
      const found = availableColumns.find((c) => c.id === id);
      if (found) return found.label;
      return id.replace(/^custom_fields\./, "").replace(/_/g, " ");
    },
    [availableColumns]
  );

  useEffect(() => {
    // Already hydrated from server for this pageKey — enable saves, skip fetch.
    if (
      opts.bootstrap &&
      opts.bootstrap.pageKey === pageKey &&
      bootstrappedPageKey.current === pageKey
    ) {
      skipNextSave.current = false;
      setReady(true);
      return;
    }

    let cancelled = false;
    skipNextSave.current = true;
    setReady(false);
    setError(null);

    (async () => {
      try {
        const [saved, availableRes] = await Promise.all([
          fetchJson<TableViewConfig | null>(
            `/api/table-views/${encodeURIComponent(pageKey)}`
          ),
          fetchJson<{ columns: AvailableColumn[] }>(
            `/api/table-views/${encodeURIComponent(pageKey)}/available-columns`
          )
        ]);
        if (cancelled) return;
        const available = availableRes.columns ?? [];
        setAvailableColumns(available);
        const availableIds = available.map((c) => c.id);
        for (const d of defaultsRef.current) {
          if (!availableIds.includes(d.id)) availableIds.push(d.id);
        }
        const merged = mergeColumnsWithDefaults(
          saved,
          defaultsRef.current,
          availableIds
        );
        setColumns(merged);
        setReady(true);
        queueMicrotask(() => {
          if (!cancelled) {
            lastSavedJson.current = JSON.stringify(merged);
            skipNextSave.current = false;
          }
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load view");
        setColumns(defaultsRef.current.map((c) => ({ ...c })));
        setReady(true);
        skipNextSave.current = false;
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // Only re-fetch when pageKey changes without matching bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  useEffect(() => {
    if (!ready || skipNextSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const snapshot = JSON.stringify(columns);
    if (snapshot === lastSavedJson.current) return;

    saveTimer.current = setTimeout(() => {
      const requestId = ++saveRequestId.current;
      setSaving(true);
      setError(null);
      void fetchJson<TableViewConfig>(
        `/api/table-views/${encodeURIComponent(pageKey)}`,
        {
          method: "PUT",
          body: JSON.stringify({ columns })
        }
      )
        .then(() => {
          if (saveRequestId.current === requestId) {
            lastSavedJson.current = snapshot;
          }
        })
        .catch((err) => {
          if (saveRequestId.current === requestId) {
            setError(err instanceof Error ? err.message : "Failed to save view");
          }
        })
        .finally(() => {
          // Only clear spinner for the latest in-flight save (overlaps from
          // rapid column toggles previously left "saving…" stuck).
          if (saveRequestId.current === requestId) {
            setSaving(false);
          }
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [columns, pageKey, ready]);

  const setColumnVisible = useCallback((id: string, visible: boolean) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible } : c))
    );
  }, []);

  const setColumnWidth = useCallback((id: string, width: number) => {
    const clamped = Math.min(480, Math.max(64, Math.round(width)));
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, width: clamped } : c))
    );
  }, []);

  const moveColumn = useCallback((id: string, direction: "up" | "down") => {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx]!;
      next[idx] = next[swapWith]!;
      next[swapWith] = tmp;
      return next;
    });
  }, []);

  const reorderColumn = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setColumns((prev) => {
      const from = prev.findIndex((c) => c.id === fromId);
      const to = prev.findIndex((c) => c.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (!item) return prev;
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const resetToDefault = useCallback(() => {
    skipNextSave.current = true;
    const availableIds = availableColumns.map((c) => c.id);
    for (const d of defaultsRef.current) {
      if (!availableIds.includes(d.id)) availableIds.push(d.id);
    }
    setColumns(
      mergeColumnsWithDefaults(null, defaultsRef.current, availableIds)
    );
    setSaving(true);
    setError(null);
    void fetchJson<{ ok: boolean }>(
      `/api/table-views/${encodeURIComponent(pageKey)}`,
      { method: "DELETE" }
    )
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to reset view");
      })
      .finally(() => {
        setSaving(false);
        queueMicrotask(() => {
          skipNextSave.current = false;
        });
      });
  }, [availableColumns, pageKey]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns]
  );

  return {
    visibleColumns,
    columns,
    availableColumns,
    labelFor,
    ready,
    saving,
    error,
    setColumnVisible,
    setColumnWidth,
    moveColumn,
    reorderColumn,
    resetToDefault
  };
}
