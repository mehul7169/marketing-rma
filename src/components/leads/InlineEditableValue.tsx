"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

/**
 * Airtable-style click-to-edit value. Blur or Enter commits; Escape cancels.
 */
export default function InlineEditableValue({
  value,
  displayValue,
  placeholder = "—",
  multiline = false,
  inputType = "text",
  disabled = false,
  className = "",
  onCommit
}: {
  value: string;
  /** Shown when not editing (defaults to value or placeholder). */
  displayValue?: string;
  placeholder?: string;
  multiline?: boolean;
  inputType?: "text" | "email" | "tel" | "number";
  disabled?: boolean;
  className?: string;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  function commit() {
    const next = draft;
    setEditing(false);
    if (next !== value) onCommit(next);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (disabled) {
    return (
      <span className={className}>{displayValue ?? (value || placeholder)}</span>
    );
  }

  if (editing) {
    const shared = {
      ref: ref as never,
      value: draft,
      onChange: (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        } else if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          commit();
        } else if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      },
      className:
        "w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm text-slate-900 outline-none ring-2 ring-slate-300"
    };

    return multiline ? (
      <textarea {...shared} rows={3} />
    ) : (
      <input {...shared} type={inputType} />
    );
  }

  return (
    <button
      type="button"
      className={`block w-full truncate rounded px-0.5 text-left hover:bg-slate-100 focus:bg-slate-100 focus:outline-none ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to edit"
    >
      {displayValue ?? (value || placeholder)}
    </button>
  );
}
