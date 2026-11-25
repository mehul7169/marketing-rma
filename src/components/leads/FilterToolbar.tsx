"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import Spinner from "@/components/ui/Spinner";
import { MOTION_OFF, transitionBase } from "@/lib/motion";

export const CONTROL_H = "h-8";

export function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 3.5h12L9.5 9v4l-3 1.5V9L2 3.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5 2.5v11M5 2.5 2.5 5M5 2.5 7.5 5M11 13.5v-11M11 13.5 8.5 11M11 13.5 13.5 11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ViewsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2.5" y="9.5" width="11" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.25" />
      <path d="M10.5 10.5 13.5 13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export const ghostBtnClass =
  `pressable inline-flex ${CONTROL_H} items-center gap-1.5 rounded px-2 text-sm text-muted hover:bg-surface-2 hover:text-fg`;

export const ghostBtnActiveClass =
  `inline-flex ${CONTROL_H} items-center gap-1.5 rounded-control bg-accent-soft px-2 text-sm font-medium text-fg`;

export function ToolbarGhostButton({
  icon,
  label,
  count,
  active,
  testId,
  title,
  onClick,
  type = "button"
}: {
  icon?: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  testId?: string;
  title?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      data-testid={testId}
      title={title ?? label}
      onClick={onClick}
      className={active ? ghostBtnActiveClass : ghostBtnClass}
    >
      {icon}
      <span className="max-[1024px]:hidden">{label}</span>
      {count ? (
        <span className="tabular-nums text-muted" data-testid={testId ? `${testId}-count` : undefined}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function FilterSearchInput({
  testId,
  labelledBy,
  label,
  placeholder,
  value,
  onChange,
  onEnter,
  pending
}: {
  testId: string;
  labelledBy?: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  pending?: boolean;
}) {
  return (
    <label className="relative min-w-[220px] flex-1 basis-0">
      <span className="sr-only" id={labelledBy}>
        {label}
      </span>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
        <SearchIcon />
      </span>
      <input
        id={testId}
        data-testid={testId}
        type="search"
        aria-labelledby={labelledBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className={`${CONTROL_H} w-full rounded border border-subtle bg-surface pl-8 pr-8 text-sm text-fg placeholder:text-muted`}
        autoComplete="off"
      />
      {pending ? (
        <span
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          data-testid="search-pending"
        >
          <Spinner size="xs" label="Searching" />
        </span>
      ) : null}
    </label>
  );
}

export function ViewModeSegment({
  value,
  onChange
}: {
  value: "cards" | "table";
  onChange: (next: "cards" | "table") => void;
}) {
  const reduced = useReducedMotion();
  const skipLayout = MOTION_OFF || reduced;
  return (
    <div
      className={`inline-flex ${CONTROL_H} overflow-hidden rounded border border-subtle`}
      role="group"
      aria-label="View mode"
    >
      {(["cards", "table"] as const).map((mode) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`relative px-2.5 text-xs ${
              selected
                ? "font-medium text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {selected ? (
              skipLayout ? (
                <span className="absolute inset-0 bg-surface-2" aria-hidden />
              ) : (
                <motion.span
                  layoutId="view-mode-pill"
                  className="absolute inset-0 bg-surface-2"
                  transition={transitionBase}
                  aria-hidden
                />
              )
            ) : null}
            <span className="relative z-10">
              {mode === "cards" ? "Cards" : "Table"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FilterChip({
  testId,
  field,
  rest,
  onEdit,
  onRemove,
  removeLabel
}: {
  testId?: string;
  field: string;
  rest: string;
  onEdit?: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex max-w-full ${CONTROL_H} items-center gap-1 rounded-full border border-subtle bg-surface-2 py-0 pl-2.5 pr-1 text-xs`}
    >
      <button
        type="button"
        className="inline-flex min-w-0 items-center gap-1 truncate text-left"
        onClick={onEdit}
      >
        <span className="text-muted">{field}</span>
        {rest ? <span className="font-normal text-fg">{rest}</span> : null}
      </button>
      <button
        type="button"
        aria-label={removeLabel}
        className="rounded-full px-1.5 text-muted hover:bg-surface-2 hover:text-fg"
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  );
}

export function ChipTextLink({
  children,
  onClick,
  testId
}: {
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="text-xs text-muted underline decoration-subtle hover:text-fg"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px bg-surface-2" aria-hidden />;
}
