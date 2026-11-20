"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

const SlotElContext = createContext<HTMLElement | null>(null);
const SetSlotElContext = createContext<(el: HTMLElement | null) => void>(
  () => {}
);

/** Lets table/view chrome (Cards/Table, Columns, Create lead) render in the header toolbar. */
export function ToolbarPortalProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <SetSlotElContext.Provider value={setEl}>
      <SlotElContext.Provider value={el}>{children}</SlotElContext.Provider>
    </SetSlotElContext.Provider>
  );
}

export function ToolbarTrailingSlot({ className }: { className?: string }) {
  const setEl = useContext(SetSlotElContext);
  return <div ref={setEl} className={className ?? "contents"} />;
}

export function ToolbarTrailing({ children }: { children: ReactNode }) {
  const el = useContext(SlotElContext);
  if (!el) return null;
  return createPortal(children, el);
}
