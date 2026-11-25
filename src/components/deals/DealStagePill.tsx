import { STAGE_PILL } from "@/components/ui/Badge";
import { dealStageLabel } from "@/lib/deals/dealLifecycle";

export default function DealStagePill({
  stage
}: {
  stage: string | null | undefined;
}) {
  const key = stage || "showed_up";
  return (
    <span
      data-testid="deal-stage-pill"
      className={`inline-flex max-w-full truncate rounded-pill px-2 py-0.5 text-xs font-medium ${
        STAGE_PILL[key] ?? STAGE_PILL.showed_up
      }`}
    >
      {dealStageLabel(stage)}
    </span>
  );
}
