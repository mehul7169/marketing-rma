"use client";

import { useEffect, useRef, useState } from "react";

export type MultiSelectOption = { value: string; label: string };

/** Dropdown of checkboxes; every toggle calls onChange with the full selection. */
export default function CheckboxMultiSelect({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selected);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(value: string) {
    const next = selectedSet.has(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    // Keep option order so URLs are stable regardless of click order.
    const order = new Map(options.map((o, i) => [o.value, i]));
    next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    onChange(next);
  }

  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  return (
    <div ref={rootRef} className="relative flex flex-col text-xs text-slate-600">
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label} filter`}
        className="mt-1 flex min-w-[160px] items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-left text-sm text-slate-900"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden className="text-slate-400">▾</span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          aria-label={label}
          className="absolute left-0 top-full z-20 mt-1 max-h-72 min-w-full overflow-auto rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No options</p>
          ) : (
            options.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(o.value)}
                  onChange={() => toggle(o.value)}
                />
                {o.label}
              </label>
            ))
          )}
          {selected.length > 0 ? (
            <button
              type="button"
              className="mt-1 w-full border-t border-slate-100 px-3 py-1.5 text-left text-xs text-slate-500 hover:text-slate-900"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
