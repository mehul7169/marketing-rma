import { COHORT_MATURITY_NOTE } from "@/lib/utils/date";

export default function CohortMaturityNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-amber-800 ${className}`}>
      {COHORT_MATURITY_NOTE}
    </p>
  );
}
