"use client";

import { useEffect, useRef, useState } from "react";
import type { UseTableViewResult } from "@/hooks/useTableView";

export default function ColumnPicker({
  view
}: {
  view: UseTableViewResult;
}) {
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        Columns
        {view.saving ? (
          <span className="ml-1 text-xs text-slate-400">saving…</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-800">Show / order</p>
            <button
              type="button"
              className="text-xs text-slate-600 underline hover:text-slate-900"
              onClick={() => view.resetToDefault()}
            >
              Reset to default
            </button>
          </div>
          {view.error ? (
            <p className="mb-2 text-xs text-red-600">{view.error}</p>
          ) : null}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {view.columns.map((col, index) => (
              <li
                key={col.id}
                draggable
                onDragStart={(e) => {
                  setDragId(col.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", col.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overId !== col.id) setOverId(col.id);
                }}
                onDragLeave={() => {
                  if (overId === col.id) setOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from =
                    e.dataTransfer.getData("text/plain") || dragId || "";
                  if (from) view.reorderColumn(from, col.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={`flex items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 ${
                  overId === col.id && dragId !== col.id
                    ? "bg-slate-100 ring-1 ring-slate-300"
                    : ""
                } ${dragId === col.id ? "opacity-50" : ""}`}
              >
                <span
                  className="cursor-grab touch-none select-none px-0.5 text-slate-400 active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-hidden
                >
                  ⋮⋮
                </span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={col.visible}
                  onChange={(e) =>
                    view.setColumnVisible(col.id, e.target.checked)
                  }
                  id={`col-${col.id}`}
                />
                <label
                  htmlFor={`col-${col.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-slate-800"
                  title={col.id}
                >
                  {view.labelFor(col.id)}
                  {col.id.startsWith("custom_fields.") ? (
                    <span className="ml-1 text-[10px] text-slate-400">
                      custom
                    </span>
                  ) : null}
                </label>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => view.moveColumn(col.id, "up")}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 disabled:opacity-30"
                    disabled={index === view.columns.length - 1}
                    onClick={() => view.moveColumn(col.id, "down")}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
