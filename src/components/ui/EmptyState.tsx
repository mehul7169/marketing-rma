import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export default function EmptyState({
  title,
  body,
  action,
  className
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-subtle px-6 py-12 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-fg">{title}</p>
      {body ? <div className="mt-1 text-sm text-muted">{body}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
