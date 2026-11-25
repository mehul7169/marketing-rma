"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { FadeIn } from "@/components/ui/Enter";
import { useRouter } from "next/navigation";
import { dealAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import DealDrawerHost from "@/components/deals/DealDrawer";
import DealOwnerAvatar from "@/components/deals/DealOwnerAvatar";
import DealQuickActions, { type DealMember } from "@/components/deals/DealQuickActions";
import DealRow from "@/components/deals/DealRow";
import DealStagePill from "@/components/deals/DealStagePill";
import { useDealDrawerParam } from "@/components/deals/useDealDrawerParam";
import { FilterPendingSurface } from "@/components/leads/FilterPending";
import ScrollableDataTable from "@/components/table-views/ScrollableDataTable";
import { toastError } from "@/components/ui/Toast";
import {
  DEAL_OPEN_GROUP_LABELS,
  formatShowedDate,
  groupOpenDeals,
  type DealOpenGroupId
} from "@/lib/deals/dealGroups";
import {
  lostReasonLabel,
  planDeal,
  type DealAction,
  type DealPayload
} from "@/lib/deals/dealLifecycle";
import type { DealTabId } from "@/lib/deals/dealListParams";
import { formatCurrencyNullable } from "@/lib/format";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import type { LifecycleActor } from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";
import { formatIST } from "@/lib/timezone";

export type LastTouch = { note: string | null; actorEmail: string | null };

const GROUP_LABEL_CLASS: Record<DealOpenGroupId, string> = {
  overdue: "text-danger",
  needs_next_step: "text-warning",
  today: "text-fg",
  tomorrow: "text-fg",
  this_week: "text-fg",
  later: "text-fg"
};

export default function DealsView({
  tabId,
  rows,
  lastTouchByLead,
  ownerEmailById,
  members,
  actor
}: {
  tabId: DealTabId;
  rows: LeadRow[];
  lastTouchByLead: Record<string, LastTouch>;
  ownerEmailById: Record<string, string>;
  members: DealMember[];
  actor: LifecycleActor;
}) {
  const preview = useOrgPreview();
  const router = useRouter();
  const { open } = useDealDrawerParam();
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  async function save(
    lead: LeadRow,
    action: DealAction,
    payload: DealPayload
  ): Promise<boolean> {
    if (preview.active) {
      toastError(preview.readOnlyMessage);
      return false;
    }
    const snapshot = lead;
    const plan = planDeal(lead, action, payload, actor);
    if (!plan.ok) {
      toastError(leadErrorToast(lead, plan.error));
      return false;
    }
    setLocalRows((rs) =>
      rs.map((r) => (r.id === lead.id ? { ...r, ...plan.patch } : r))
    );
    const res = await dealAction(lead.id, action, payload);
    if (!res.ok) {
      setLocalRows((rs) => rs.map((r) => (r.id === lead.id ? snapshot : r)));
      toastError(leadErrorToast(lead, res.error));
      return false;
    }
    setLocalRows((rs) => rs.map((r) => (r.id === lead.id ? res.lead : r)));
    router.refresh();
    return true;
  }

  const groups = useMemo(() => {
    if (tabId !== "open") return [];
    return groupOpenDeals(localRows.filter((r) => r.deal_closed === null));
  }, [localRows, tabId]);

  return (
    <>
      <FilterPendingSurface className="flex min-h-0 flex-1 flex-col">
        {tabId === "open" ? (
          <FadeIn id="deals-open-table" className="flex min-h-0 flex-1 flex-col">
          <ScrollableDataTable>
            {groups.length === 0 ? (
              <p className="px-3 py-8 text-sm text-muted">No open deals.</p>
            ) : (
              <table className="scrollable-data-table w-full min-w-[64rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-subtle text-xs text-muted">
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Next step</th>
                    <th className="px-3 py-2 font-medium">Last touch</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="w-36 px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.id} data-testid={`deals-group-${g.id}`}>
                    <tr>
                      <td
                        colSpan={7}
                        className={`bg-surface-2 px-3 py-1.5 text-xs font-semibold ${GROUP_LABEL_CLASS[g.id]}`}
                      >
                        {DEAL_OPEN_GROUP_LABELS[g.id]}
                        <span className="ml-1 font-normal text-muted">
                          {g.rows.length}
                        </span>
                      </td>
                    </tr>
                    <AnimatePresence initial={false}>
                    {g.rows.map((lead) => (
                      <DealRow
                        key={lead.id}
                        lead={lead}
                        lastTouch={
                          lastTouchByLead[lead.id] ?? { note: null, actorEmail: null }
                        }
                        ownerEmail={
                          lead.owner_id ? ownerEmailById[lead.owner_id] ?? null : null
                        }
                        members={members}
                        preview={preview.active}
                        overdue={g.id === "overdue"}
                        onOpen={() => open(lead.id)}
                        onSave={(action, payload) => save(lead, action, payload)}
                      />
                    ))}
                    </AnimatePresence>
                  </tbody>
                ))}
              </table>
            )}
          </ScrollableDataTable>
          </FadeIn>
        ) : (
          <ClosedTable
            tabId={tabId}
            rows={localRows}
            ownerEmailById={ownerEmailById}
            members={members}
            preview={preview.active}
            onOpen={(id) => open(id)}
            onSave={save}
          />
        )}
      </FilterPendingSurface>
      <DealDrawerHost
        members={members}
        onLeadPatched={(lead) =>
          setLocalRows((rs) => rs.map((r) => (r.id === lead.id ? lead : r)))
        }
        onSave={save}
      />
      {preview.active ? (
        <button
          type="button"
          data-testid="deals-force-write"
          className="sr-only"
          onClick={() => {
            const lead = localRows[0];
            if (!lead) return;
            void dealAction(lead.id, "set_value", { value: 1 }).then((res) => {
              if (!res.ok) toastError(res.error);
            });
          }}
        >
          Force write
        </button>
      ) : null}
    </>
  );
}

function ClosedTable({
  tabId,
  rows,
  ownerEmailById,
  members,
  preview,
  onOpen,
  onSave
}: {
  tabId: DealTabId;
  rows: LeadRow[];
  ownerEmailById: Record<string, string>;
  members: DealMember[];
  preview: boolean;
  onOpen: (id: string) => void;
  onSave: (
    lead: LeadRow,
    action: DealAction,
    payload: DealPayload
  ) => Promise<boolean>;
}) {
  const showValue = tabId !== "lost";
  const showLost = tabId !== "won";
  return (
    <FadeIn id={`deals-${tabId}-table`} className="flex min-h-0 flex-1 flex-col">
    <ScrollableDataTable>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-sm text-muted">No deals in this view.</p>
      ) : (
        <table className="scrollable-data-table w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="border-b border-subtle text-xs text-muted">
              <th className="px-3 py-2 font-medium">Lead</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Closed date</th>
              {showValue ? (
                <th className="px-3 py-2 font-medium">Value</th>
              ) : null}
              {showLost ? (
                <th className="px-3 py-2 font-medium">Lost reason</th>
              ) : null}
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Showed date</th>
              <th className="w-28 px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr
                key={lead.id}
                data-testid={`deal-row-${lead.id}`}
                className="group cursor-pointer border-b border-subtle hover:bg-surface-2"
                onClick={() => onOpen(lead.id)}
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium text-fg">
                    {lead.name || lead.email}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <DealStagePill stage={lead.post_call_status} />
                  <div className="mt-0.5 text-xs text-muted">
                    {lead.deal_closed === true
                      ? "Won"
                      : lead.deal_closed === false
                        ? "Lost"
                        : "Open"}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {lead.closed_at ? formatIST(lead.closed_at, "d MMM yyyy") : "—"}
                </td>
                {showValue ? (
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatCurrencyNullable(lead.deal_value)}
                  </td>
                ) : null}
                {showLost ? (
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {lostReasonLabel(lead.lost_reason) ?? "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2.5">
                  <DealOwnerAvatar
                    email={
                      lead.owner_id ? ownerEmailById[lead.owner_id] ?? null : null
                    }
                  />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {formatShowedDate(lead.call_showed_at) || "—"}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className={preview ? "" : "opacity-0 group-hover:opacity-100"}>
                    <DealQuickActions
                      lead={lead}
                      members={members}
                      preview={preview}
                      onSave={(action, payload) => onSave(lead, action, payload)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ScrollableDataTable>
    </FadeIn>
  );
}
