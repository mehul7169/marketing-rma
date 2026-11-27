"use client";

import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
  type VirtualElement
} from "@floating-ui/react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { popoverMotion } from "@/components/ui/Enter";
import { MOTION_OFF } from "@/lib/motion";

const VIEWPORT_PAD = 8;
const IS_JSDOM =
  typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

const MIDDLEWARE = [
  offset(6),
  flip({ padding: VIEWPORT_PAD, fallbackAxisSideDirection: "start" }),
  shift({ padding: VIEWPORT_PAD }),
  size({
    padding: VIEWPORT_PAD,
    apply({ availableHeight, elements }) {
      const h = Math.max(0, Math.floor(availableHeight));
      // jsdom reports 0 available height; don't clip the popover to a 0px box.
      const next = h < 32 ? "" : `${h}px`;
      if (elements.floating.style.maxHeight !== next) {
        elements.floating.style.maxHeight = next;
      }
    }
  })
];

function followWhileMounted(
  referenceEl: Element | VirtualElement,
  floatingEl: HTMLElement,
  update: () => void
) {
  if (IS_JSDOM) {
    update();
    return () => {};
  }
  return autoUpdate(referenceEl, floatingEl, update, {
    ancestorScroll: true,
    ancestorResize: true,
    elementResize: typeof ResizeObserver !== "undefined",
    layoutShift: false
  });
}

function viewportCenter(): VirtualElement {
  return {
    getBoundingClientRect() {
      const x =
        typeof window === "undefined" ? 0 : Math.round(window.innerWidth / 2);
      const y =
        typeof window === "undefined" ? 0 : Math.round(window.innerHeight / 2);
      return {
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
        width: 0,
        height: 0
      };
    }
  };
}

/** Scale/fade origin on the inner panel, opposite the placement side. */
export function originFromPlacement(placement: Placement): string {
  const [side, align] = placement.split("-");
  const y =
    side === "top"
      ? "bottom"
      : side === "bottom"
        ? "top"
        : align === "end"
          ? "bottom"
          : align === "start"
            ? "top"
            : "center";
  const x =
    side === "left"
      ? "right"
      : side === "right"
        ? "left"
        : align === "end"
          ? "right"
          : align === "start"
            ? "left"
            : "center";
  return `${y} ${x}`;
}

export default function ActionPopover({
  open,
  onOpenChange,
  trigger,
  reference,
  children,
  footer,
  widthClass = "w-72",
  bodyClassName = "p-3",
  panelClassName = "overflow-hidden",
  role = "dialog",
  placement = "bottom-start",
  labelledBy
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
  reference?: HTMLElement | null;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  bodyClassName?: string;
  panelClassName?: string;
  role?: "dialog" | "menu";
  placement?: Placement;
  labelledBy?: string;
}) {
  const reduced = useReducedMotion();
  const skipMotion = MOTION_OFF || reduced;
  const fallback = useMemo(() => viewportCenter(), []);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement,
    strategy: "fixed",
    whileElementsMounted: followWhileMounted,
    middleware: MIDDLEWARE
  });

  useLayoutEffect(() => {
    if (trigger) return;
    refs.setPositionReference(reference ?? fallback);
    // Omit `refs` from deps: setPositionReference wraps the node in a new
    // virtual element each call, which would retrigger this effect forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reference, fallback]);

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
    ancestorScroll: false
  });
  const roleIx = useRole(context, { role });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    roleIx
  ]);

  useLayoutEffect(() => {
    if (!open || IS_JSDOM) return;
    const active = document.activeElement;
    prevFocusRef.current = active instanceof HTMLElement ? active : null;
    const node = refs.floating.current;
    if (node) {
      const first = node.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (first ?? node).focus();
    }
    return () => {
      prevFocusRef.current?.focus();
    };
    // Only re-run when the popover opens/closes. Position updates must not refocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const floating =
    open && typeof document !== "undefined" ? (
      <FloatingPortal>
        {/* Positioning only. Motion must not live here — it would overwrite
            floatingStyles.transform and pin the panel at 0,0. */}
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({
            className: `z-[70] ${widthClass}`,
            "aria-labelledby": labelledBy,
            tabIndex: -1
          })}
          data-action-popover=""
        >
          <motion.div
            data-action-popover-panel=""
            className={`flex max-h-[inherit] flex-col rounded-card border border-subtle bg-surface shadow-card ${panelClassName}`}
            style={{ transformOrigin: originFromPlacement(context.placement) }}
            initial={skipMotion ? false : popoverMotion.initial}
            animate={skipMotion ? { opacity: 1 } : popoverMotion.animate}
            transition={
              skipMotion ? { duration: 0 } : popoverMotion.transition
            }
          >
            <div
              className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`.trim()}
            >
              {children}
            </div>
            {footer ? (
              <div className="shrink-0 border-t border-subtle bg-surface px-3 py-2">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      </FloatingPortal>
    ) : null;

  return (
    <>
      {trigger ? (
        <span
          className="inline-flex max-w-full"
          ref={refs.setReference}
          {...getReferenceProps()}
        >
          {trigger}
        </span>
      ) : null}
      {floating}
    </>
  );
}
