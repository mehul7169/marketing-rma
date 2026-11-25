import type { ReactNode } from "react";
import Card from "@/components/ui/Card";

export default function ChartCard({
  title,
  toggle,
  legend,
  children
}: {
  title: string;
  toggle?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      title={title}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {legend}
          {toggle}
        </div>
      }
    >
      {children}
    </Card>
  );
}
