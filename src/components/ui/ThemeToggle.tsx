"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/cn";
import { useTheme } from "@/components/ui/ThemeProvider";
import type { ThemePreference } from "@/lib/ui/theme";

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: string;
}> = [
  {
    value: "light",
    label: "Light",
    icon: "M8 11.5A3.5 3.5 0 1 0 8 4.5a3.5 3.5 0 0 0 0 7ZM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"
  },
  {
    value: "dark",
    label: "Dark",
    icon: "M12.5 10.2A5.5 5.5 0 0 1 6.2 3.2 5.5 5.5 0 1 0 12.5 10.2Z"
  },
  {
    value: "system",
    label: "System",
    icon: "M2.5 3.5h11v7h-11zM5.5 13h5M8 10.5V13"
  }
];

function ThemeIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export default function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { preference, setPreference } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (collapsed) {
    const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2]!;
    function cycle() {
      const i = OPTIONS.findIndex((o) => o.value === preference);
      const next = OPTIONS[(i + 1) % OPTIONS.length]!;
      setPreference(next.value);
    }
    return (
      <button
        type="button"
        onClick={cycle}
        disabled={!ready}
        title={`Theme: ${current.label}`}
        aria-label={`Theme ${current.label}. Click to switch`}
        data-testid="theme-toggle"
        className="flex w-full items-center justify-center rounded-pill px-2 py-1.5 text-muted hover:bg-surface-2 hover:text-fg"
      >
        <ThemeIcon d={current.icon} />
      </button>
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = OPTIONS.findIndex((o) => o.value === preference);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setPreference(OPTIONS[(i + 1 + OPTIONS.length) % OPTIONS.length]!.value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setPreference(OPTIONS[(i - 1 + OPTIONS.length) % OPTIONS.length]!.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      data-testid="theme-toggle"
      className="flex rounded-pill bg-surface-2 p-0.5"
      onKeyDown={onKeyDown}
    >
      {OPTIONS.map((opt) => {
        const selected = ready && preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            title={opt.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => setPreference(opt.value)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-pill px-1.5 py-1",
              selected
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-fg"
            )}
          >
            <ThemeIcon d={opt.icon} />
          </button>
        );
      })}
    </div>
  );
}
