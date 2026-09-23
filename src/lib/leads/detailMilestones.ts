import type { LeadActivityType } from "@/lib/leads/actionStatus";
import type { LeadRow } from "@/lib/leads/types";

export type DetailMilestone = {
  type: LeadActivityType;
  outcome: string;
  summary: string;
};

type MilestoneInput = {
  qualified?: boolean | null;
  setter_verified?: boolean | null;
  call_showed?: boolean | null;
  deal_closed?: boolean | null;
};

/**
 * Lead-detail toggles that count as actions (timeline + Last Action).
 * Only true/false transitions that change the stored value; clearing to null is an undo.
 * Returned in funnel order — the last entry is the most recent action.
 */
export function detailMilestones(
  existing: Pick<LeadRow, "qualified" | "setter_verified" | "call_showed" | "deal_closed">,
  input: MilestoneInput
): DetailMilestone[] {
  const out: DetailMilestone[] = [];
  const changed = (key: keyof MilestoneInput): boolean | null => {
    const next = input[key];
    if (next === undefined || next === null || next === existing[key]) return null;
    return next;
  };

  const qualified = changed("qualified");
  if (qualified !== null) {
    out.push({
      type: "qualification",
      outcome: qualified ? "qualified" : "unqualified",
      summary: qualified ? "Marked Qualified" : "Marked Unqualified"
    });
  }
  const verified = changed("setter_verified");
  if (verified !== null) {
    out.push({
      type: "setter_verification",
      outcome: verified ? "verified" : "unqualified",
      summary: verified ? "Setter verified" : "Setter marked Unqualified"
    });
  }
  const showed = changed("call_showed");
  if (showed !== null) {
    out.push({
      type: "show_outcome",
      outcome: showed ? "showed" : "no_show",
      summary: showed ? "Call showed" : "Call no-show"
    });
  }
  const won = changed("deal_closed");
  if (won !== null) {
    out.push({
      type: "deal_outcome",
      outcome: won ? "won" : "lost",
      summary: won ? "Deal won" : "Deal lost"
    });
  }
  return out;
}
