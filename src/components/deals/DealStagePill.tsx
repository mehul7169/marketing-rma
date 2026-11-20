import { dealStageLabel } from "@/lib/deals/dealLifecycle";

const STAGE_CLASS: Record<string, string> = {
  showed_up: "bg-slate-100 text-slate-700",
  follow_up_call_booked: "bg-sky-100 text-sky-800",
  awaiting_lead_response: "bg-teal-100 text-teal-800",
  contract_shared: "bg-violet-100 text-violet-800",
  awaiting_payment: "bg-amber-100 text-amber-900"
};

export default function DealStagePill({
  stage
}: {
  stage: string | null | undefined;
}) {
  const key = stage || "showed_up";
  return (
    <span
      data-testid="deal-stage-pill"
      className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium ${
        STAGE_CLASS[key] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {dealStageLabel(stage)}
    </span>
  );
}
