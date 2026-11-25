import type { InputHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-control border border-subtle bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-muted",
        className
      )}
      {...props}
    />
  );
}
