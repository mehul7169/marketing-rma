import {
  ACTION_STATUSES,
  displayActionStatus,
  type ActionStatus
} from "@/lib/leads/actionStatus";

const STYLES: Record<ActionStatus, string> = {
  Closed: "bg-emerald-50 text-emerald-800",
  Dead: "bg-slate-200 text-slate-600",
  "Follow-up Overdue": "bg-red-50 text-red-800",
  "Follow-up Due": "bg-amber-50 text-amber-900",
  "Call Unanswered": "bg-orange-50 text-orange-900",
  "Personally Contacted": "bg-sky-50 text-sky-900",
  "Qualified Call Booked": "bg-blue-50 text-blue-800",
  "Call Booked": "bg-indigo-50 text-indigo-800",
  Untouched: "bg-slate-100 text-slate-700"
};

export function actionStatusLabel(
  actionStatus: string | null | undefined
): ActionStatus {
  return displayActionStatus(actionStatus);
}

export default function ActionStatusBadge({
  actionStatus
}: {
  actionStatus: string | null | undefined;
}) {
  const label = displayActionStatus(actionStatus);
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[label] ?? STYLES.Untouched}`}
      title={
        actionStatus == null
          ? "Null action_status (pre-backfill) — shown as Untouched"
          : undefined
      }
    >
      {label}
    </span>
  );
}

export { ACTION_STATUSES };
