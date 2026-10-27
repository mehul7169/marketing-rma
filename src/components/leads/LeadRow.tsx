"use client";

export default function LeadRow({
  onOpen,
  children
}: {
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      className="group cursor-pointer hover:bg-slate-50/60"
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
