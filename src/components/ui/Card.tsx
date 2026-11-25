import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export default function Card({
  title,
  actions,
  className,
  padding = "md",
  children
}: {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  padding?: "sm" | "md";
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "lift-card rounded-card border border-subtle bg-surface shadow-card",
        padding === "md" ? "p-6" : "p-4",
        className
      )}
    >
      {title || actions ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          {title ? (
            <h2 className="section-label text-muted">{title}</h2>
          ) : (
            <span />
          )}
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
