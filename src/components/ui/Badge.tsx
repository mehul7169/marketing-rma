import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-fg"
};

/** Pipeline + deal stages — one map for pills across the app. */
export const STAGE_PILL: Record<string, string> = {
  new: "bg-surface-2 text-muted",
  contacted: "bg-surface-2 text-fg",
  qualified: "bg-accent-soft text-fg",
  call_booked: "bg-accent-soft text-fg",
  showed_up: "bg-success-soft text-success",
  dead: "bg-surface-2 text-muted",
  follow_up_call_booked: "bg-accent-soft text-fg",
  awaiting_lead_response: "bg-surface-2 text-fg",
  contract_shared: "bg-warning-soft text-warning",
  awaiting_payment: "bg-warning-soft text-warning"
};

const PILL =
  "inline-flex max-w-full items-center truncate rounded-pill px-2 py-0.5 text-xs font-medium";

export default function Badge({
  tone = "neutral",
  stage,
  className,
  children
}: {
  tone?: BadgeTone;
  stage?: string;
  className?: string;
  children: ReactNode;
}) {
  const color = stage
    ? (STAGE_PILL[stage] ?? STAGE_PILL.new)
    : TONE[tone];
  return <span className={cn(PILL, color, className)}>{children}</span>;
}

export function Pill(props: Parameters<typeof Badge>[0]) {
  return <Badge {...props} />;
}
