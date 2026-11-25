import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

export default function StatStrip({
  title,
  actions,
  children,
  className
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card title={title} actions={actions} className={className} padding="md">
      <div className="flex flex-wrap gap-0 divide-x divide-subtle">
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div key={i} className={cn("min-w-[8rem] flex-1 px-5 first:pl-0 last:pr-0")}>
                {child}
              </div>
            ))
          : children}
      </div>
    </Card>
  );
}
