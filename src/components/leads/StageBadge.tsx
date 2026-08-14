import type { LeadStage } from "@/lib/leads/computeStage";

const STYLES: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700",
  form_filled: "bg-slate-100 text-slate-700",
  qualified: "bg-blue-50 text-blue-800",
  disqualified: "bg-slate-100 text-slate-500",
  booked: "bg-blue-50 text-blue-800",
  verified: "bg-blue-50 text-blue-800",
  showed: "bg-blue-50 text-blue-800",
  no_show: "bg-slate-100 text-slate-500",
  closed: "bg-emerald-50 text-emerald-800",
  lost: "bg-slate-100 text-slate-500"
};

const LABELS: Record<string, string> = {
  lead: "Lead",
  form_filled: "Form filled",
  qualified: "Qualified",
  disqualified: "Disqualified",
  booked: "Booked",
  verified: "Verified",
  showed: "Showed",
  no_show: "No-show",
  closed: "Closed",
  lost: "Lost"
};

export function stageLabel(stage: string | null): string {
  if (!stage) return "Lead";
  return LABELS[stage] ?? stage;
}

export default function StageBadge({ stage }: { stage: string | null }) {
  const key = (stage ?? "lead") as LeadStage;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[key] ?? STYLES.lead}`}
    >
      {stageLabel(stage)}
    </span>
  );
}
