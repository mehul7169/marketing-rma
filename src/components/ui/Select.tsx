import type { SelectHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full rounded-control border border-subtle bg-surface-2 px-3 py-2 text-sm text-fg disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
