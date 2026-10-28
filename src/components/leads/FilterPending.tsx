"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction
} from "react";

const FilterPendingContext = createContext<{
  pending: boolean;
  start: TransitionStartFunction;
}>({ pending: false, start: (cb) => cb() });

export function FilterPendingRoot({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <FilterPendingContext.Provider value={{ pending, start }}>
      {children}
    </FilterPendingContext.Provider>
  );
}

export function useFilterPending() {
  return useContext(FilterPendingContext);
}

export function FilterPendingSurface({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFilterPending();
  return (
    <div
      className={`${pending ? "pointer-events-none opacity-60" : ""} ${className}`.trim()}
      aria-busy={pending}
    >
      {children}
    </div>
  );
}
