import type { LeadListFilters } from "@/lib/leads/types";

export type LeadListSortClause = {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
};

/**
 * Order clauses for listLeads. Work Queue sorts are created_at / next_action_at;
 * `/leads` still uses the KPI date field when sort is omitted or "date".
 */
export function leadListSortClauses(
  sort: LeadListFilters["sort"] | undefined,
  dateField: string
): LeadListSortClause[] {
  if (sort === "oldest") {
    return [
      { column: "created_at", ascending: true },
      { column: "id", ascending: true }
    ];
  }
  if (sort === "follow_up" || sort === "queue") {
    return [
      { column: "next_action_at", ascending: true, nullsFirst: false },
      { column: "created_at", ascending: false },
      { column: "id", ascending: false }
    ];
  }
  if (sort === "newest") {
    return [
      { column: "created_at", ascending: false },
      { column: "id", ascending: false }
    ];
  }
  return [{ column: dateField, ascending: false }];
}
