"use client";

import type { ReactNode } from "react";
import CountUp from "@/components/ui/CountUp";
import TabInk from "@/components/ui/TabInk";
import { cn } from "@/components/ui/cn";
import { formatInteger } from "@/lib/format";

export type TabItem = {
  id: string;
  label: ReactNode;
  href?: string;
  count?: number;
};

export default function Tabs({
  items,
  activeId,
  ariaLabel,
  onSelect
}: {
  items: TabItem[];
  activeId: string;
  ariaLabel: string;
  onSelect?: (id: string) => void;
}) {
  const inkId = `tabs-${ariaLabel}`;
  return (
    <div
      className="flex flex-wrap items-end gap-x-6 border-b border-subtle"
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((tab) => {
        const active = tab.id === activeId;
        const className = cn(
          "relative -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-0.5 pb-2 text-sm",
          active ? "font-medium text-fg" : "text-muted hover:text-fg"
        );
        const inner = (
          <>
            {tab.label}
            {tab.count != null ? (
              <CountUp
                value={tab.count}
                format={formatInteger}
                speed="badge"
                className="tabular-nums text-muted"
              />
            ) : null}
            <TabInk active={active} layoutId={inkId} />
          </>
        );
        if (tab.href) {
          return (
            <a
              key={tab.id}
              role="tab"
              aria-selected={active}
              href={tab.href}
              className={className}
            >
              {inner}
            </a>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={className}
            onClick={() => onSelect?.(tab.id)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
