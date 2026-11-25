"use client";

import { cn } from "@/components/ui/cn";

export default function LeadRow({
  onOpen,
  children,
  fx
}: {
  onOpen?: () => void;
  children: React.ReactNode;
  fx?: "flash" | "shake" | null;
}) {
  return (
    <tr
      className={cn(
        "group cursor-pointer hover:bg-surface-2/60",
        fx === "flash" && "cell-flash",
        fx === "shake" && "motion-shake"
      )}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (
          t.closest(
            "a, button, input, textarea, select, label, [data-no-row-nav]"
          )
        ) {
          return;
        }
        onOpen?.();
      }}
    >
      {children}
    </tr>
  );
}
