"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

function prefersHover() {
  return window.matchMedia("(hover: hover)").matches;
}

/**
 * Subtle circled "i" with a fixed-position tooltip (avoids overflow:hidden clipping).
 * Desktop: hover. Mobile: tap to toggle.
 */
export default function InfoTip({
  text,
  className = ""
}: {
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  function place() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipWidth = tipRef.current?.offsetWidth ?? 288;
    const tipHeight = tipRef.current?.offsetHeight ?? 0;
    const margin = 8;
    let left = r.left + r.width / 2;
    left = Math.min(
      window.innerWidth - tipWidth / 2 - margin,
      Math.max(tipWidth / 2 + margin, left)
    );
    let top = r.bottom + margin;
    if (tipHeight > 0 && top + tipHeight > window.innerHeight - margin) {
      top = Math.max(margin, r.top - tipHeight - margin);
    }
    setCoords({ top, left });
  }

  function show() {
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    place();
    const raf = requestAnimationFrame(() => {
      place();
    });

    function onScrollOrResize() {
      place();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setOpen(false);
    }

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label="More info"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[9px] font-medium leading-none text-slate-400 hover:border-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
        onMouseEnter={() => {
          if (prefersHover()) show();
        }}
        onMouseLeave={() => {
          if (prefersHover()) setOpen(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (prefersHover()) return;
          if (open) setOpen(false);
          else show();
        }}
      >
        i
      </button>
      {open
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[100] w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-700 shadow-sm"
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? "visible" : "hidden"
              }}
            >
              {text}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
