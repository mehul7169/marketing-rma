"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  loadLeadDrawer,
  type LeadDrawerPayload
} from "@/app/leads/drawer/loadDrawer";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import CopyValue from "@/components/CopyValue";
import CustomFieldsPanel from "@/components/leads/CustomFieldsPanel";
import DealOwnerAvatar from "@/components/deals/DealOwnerAvatar";
import DealQuickActions, { type DealMember } from "@/components/deals/DealQuickActions";
import DealStagePill from "@/components/deals/DealStagePill";
import LogFollowUpForm from "@/components/deals/LogFollowUpForm";
import { useDealDrawerParam } from "@/components/deals/useDealDrawerParam";
import { toastError } from "@/components/ui/Toast";
import { motion, useReducedMotion } from "motion/react";
import { MOTION_OFF, transitionBase } from "@/lib/motion";
import {
  formatDealDueAt,
  formatShowedDate,
  needsNextStep,
  whatsappHref
} from "@/lib/deals/dealGroups";
import {
  formatDealStatusLine,
  type DealAction,
  type DealPayload
} from "@/lib/deals/dealLifecycle";
import { formatCurrencyNullable } from "@/lib/format";
import { activityTypeLabel } from "@/lib/leads/activityLabels";
import { displayLeadEmail } from "@/lib/leads/contactNormalize";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import type { BookingHistoryEntry, LeadRow } from "@/lib/leads/types";
import { formatISTDateTime } from "@/lib/timezone";
import { actorDisplayName } from "@/lib/deals/dealGroups";

const DEAL_ACTIVITY = new Set([
  "deal_follow_up",
  "deal_next_step_set",
  "deal_stage_changed",
  "deal_owner_changed",
  "deal_outcome",
  "deal_reopened"
]);

const NOTE_WRAP = "break-words [overflow-wrap:anywhere]";
const CACHE_MAX = 12;
const drawerCache = new Map<string, LeadDrawerPayload>();

export function resetDealDrawerCache() {
  drawerCache.clear();
}

function putCache(id: string, data: LeadDrawerPayload) {
  drawerCache.delete(id);
  drawerCache.set(id, data);
  while (drawerCache.size > CACHE_MAX) {
    const oldest = drawerCache.keys().next().value;
    if (oldest) drawerCache.delete(oldest);
  }
}

export default function DealDrawerHost({
  members,
  onLeadPatched,
  onSave
}: {
  members: DealMember[];
  onLeadPatched?: (lead: LeadRow) => void;
  onSave: (
    lead: LeadRow,
    action: DealAction,
    payload: DealPayload
  ) => Promise<boolean>;
}) {
  const { dealId, close } = useDealDrawerParam();
  const reduced = useReducedMotion();
  const skipMotion = MOTION_OFF || reduced;
  const [payload, setPayload] = useState<LeadDrawerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const onPatchedRef = useRef(onLeadPatched);
  onPatchedRef.current = onLeadPatched;

  const load = useCallback(async (id: string) => {
    const seq = ++seqRef.current;
    setError(null);
    const res = await loadLeadDrawer(id);
    if (seq !== seqRef.current) return;
    if (!res.ok) {
      if (!drawerCache.get(id)) setPayload(null);
      setError(res.error);
    } else {
      putCache(id, res.data);
      setPayload(res.data);
      onPatchedRef.current?.(res.data.lead);
    }
  }, []);

  useEffect(() => {
    if (!dealId) {
      setError(null);
      return;
    }
    const cached = drawerCache.get(dealId);
    if (cached) {
      setPayload(cached);
      setError(null);
      void load(dealId);
      return;
    }
    void load(dealId);
  }, [dealId, load]);

  useEffect(() => {
    if (!dealId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-action-popover]")) return;
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, dealId]);

  if (!dealId) return null;

  const shown =
    payload?.lead.id === dealId ? payload : drawerCache.get(dealId) ?? null;

  function onBackdrop(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("[data-action-popover]")) return;
    close();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.button
        type="button"
        data-testid="deal-drawer-backdrop"
        aria-label="Close deal"
        className="absolute inset-0 bg-overlay"
        onClick={onBackdrop}
        initial={skipMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transitionBase}
      />
      <aside
        role="dialog"
        aria-modal="true"
        data-testid="deal-drawer"
        className="relative z-10 flex h-full w-full min-w-0 max-w-xl flex-col overflow-x-hidden border-l border-subtle bg-surface shadow-card"
      >
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <span className="min-w-0 truncate text-sm font-medium text-fg">
            {shown?.lead.name || shown?.lead.email || "Deal"}
          </span>
          <button
            type="button"
            data-testid="deal-drawer-close"
            onClick={close}
            className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-2"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <motion.div
            className="h-full min-w-0 w-full overflow-y-auto overflow-x-hidden px-4 py-4"
            initial={skipMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            transition={transitionBase}
          >
            {error && !shown ? (
              <p className="text-sm text-danger">{error}</p>
            ) : shown && shown.lead.id === dealId ? (
              <DealDrawerBody
                data={shown}
                members={members}
                onReload={() => void load(shown.lead.id)}
                onSave={onSave}
              />
            ) : (
              <div className="space-y-3">
                <div className="h-6 w-40 skeleton-shimmer rounded bg-surface-2" />
                <div className="h-12 skeleton-shimmer rounded bg-surface-2" />
              </div>
            )}
          </motion.div>
        </div>
      </aside>
    </div>
  );
}

function DealDrawerBody({
  data,
  members,
  onReload,
  onSave
}: {
  data: LeadDrawerPayload;
  members: DealMember[];
  onReload: () => void;
  onSave: (
    lead: LeadRow,
    action: DealAction,
    payload: DealPayload
  ) => Promise<boolean>;
}) {
  const preview = useOrgPreview();
  const { lead, activities } = data;
  const [followUp, setFollowUp] = useState(false);
  const missing = needsNextStep(lead);
  const wa = whatsappHref(lead.phone);
  const owner = members.find((m) => m.userId === lead.owner_id);
  const open = lead.deal_closed === null;

  async function save(action: DealAction, payload: DealPayload) {
    const ok = await onSave(lead, action, payload);
    if (ok) {
      setFollowUp(false);
      onReload();
    }
    return ok;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-fg">
            {lead.name || lead.email}
          </h2>
          <DealStagePill stage={lead.post_call_status} />
        </div>
        <p className="text-xs text-muted">{formatDealStatusLine(lead)}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {preview ? (
            <DealOwnerAvatar email={owner?.email} />
          ) : (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              Owner
              <select
                data-testid="deal-drawer-owner"
                className="rounded border border-subtle px-1.5 py-1 text-sm text-fg"
                value={lead.owner_id ?? ""}
                onChange={(e) =>
                  void save("assign_owner", {
                    ownerId: e.target.value || null
                  })
                }
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {actorDisplayName(m.email)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {preview ? (
            <span className="text-sm text-fg">
              {formatCurrencyNullable(lead.deal_value)}
            </span>
          ) : (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              Value
              <input
                data-testid="deal-drawer-value"
                type="number"
                min={0}
                defaultValue={lead.deal_value ?? ""}
                className="w-28 rounded border border-subtle px-1.5 py-1 text-sm"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") return;
                  const n = Number(raw);
                  if (!Number.isFinite(n) || n < 0) {
                    toastError(leadErrorToast(lead, "Enter a value of 0 or more."));
                    return;
                  }
                  if (n === lead.deal_value) return;
                  void save("set_value", { value: n });
                }}
              />
            </label>
          )}
          <span className="text-xs text-muted">
            {formatShowedDate(lead.call_showed_at)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1">
            {displayLeadEmail(lead.email) === "No email"
              ? "No email"
              : lead.email}
            {displayLeadEmail(lead.email) !== "No email" ? (
              <CopyValue value={lead.email} kind="email" />
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1">
            {lead.phone || "—"}
            <CopyValue value={lead.phone} kind="phone" />
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                data-testid="deal-whatsapp"
                className="text-xs text-success hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                WhatsApp
              </a>
            ) : null}
          </span>
        </div>
      </header>

      {open ? (
        <section
          className={`rounded border px-3 py-3 ${
            missing ? "border-warning-soft bg-warning-soft" : "border-subtle bg-surface-2"
          }`}
          data-testid="deal-next-step-card"
        >
          {missing ? (
            <p className="text-sm font-medium text-warning">Set the next step</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-fg">{lead.next_step}</p>
              <p className="text-xs text-muted">
                {formatDealDueAt(lead.next_action_at)}
              </p>
            </div>
          )}
          {preview ? null : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-control bg-accent px-2.5 py-1 text-xs text-accent-fg"
                onClick={() => setFollowUp(true)}
              >
                Log follow-up
              </button>
              <button
                type="button"
                className="rounded px-2.5 py-1 text-xs text-fg hover:bg-surface"
                onClick={() => setFollowUp(true)}
              >
                Change
              </button>
            </div>
          )}
          {followUp && !preview ? (
            <div className="mt-3 rounded border border-subtle bg-surface p-3">
              <LogFollowUpForm
                lead={lead}
                embedded
                onCancel={() => setFollowUp(false)}
                onSubmit={save}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {preview ? null : (
        <DealQuickActions
          lead={lead}
          members={members}
          preview={false}
          onSave={save}
        />
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium text-fg">Timeline</h3>
        <ul className="space-y-2" data-testid="deal-drawer-activity">
          {activities.length === 0 ? (
            <li className="text-sm text-muted">No activity yet.</li>
          ) : (
            activities.map((a) => {
              const dealish = DEAL_ACTIVITY.has(String(a.type));
              return (
                <li
                  key={a.id}
                  data-testid={
                    a.type === "deal_follow_up" ? "deal-activity-follow-up" : undefined
                  }
                  className={`rounded border px-3 py-2 text-sm ${
                    dealish
                      ? "border-accent-soft bg-accent-soft"
                      : "border-subtle bg-surface"
                  }`}
                >
                  <div className="flex justify-between gap-2 text-xs text-muted">
                    <span>
                      {activityTypeLabel(String(a.type))}
                      {a.outcome ? ` · ${a.outcome}` : ""}
                    </span>
                    <span>{formatISTDateTime(a.created_at)}</span>
                  </div>
                  <div className={`mt-0.5 text-fg ${NOTE_WRAP}`}>
                    {a.note || "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {actorDisplayName(a.actor_email)}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <details className="rounded border border-subtle">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-fg">
          Lead context
        </summary>
        <div className="space-y-3 border-t border-subtle px-3 py-3">
          <CustomFieldsPanel customFields={lead.custom_fields} />
          <p className="text-xs text-muted">
            Source {lead.lead_source || "—"}
            {lead.utm_source ? ` · utm_source ${lead.utm_source}` : ""}
            {lead.utm_campaign ? ` · ${lead.utm_campaign}` : ""}
          </p>
          <p className="text-xs text-muted">
            Setter {lead.qualified_by || "—"}
            {lead.qualified === true
              ? " · qualified"
              : lead.qualified === false
                ? " · not qualified"
                : ""}
          </p>
          <BookingHistoryList entries={lead.booking_history ?? []} />
          {lead.recording_url ? (
            <a
              href={lead.recording_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent-text hover:underline"
            >
              Recording
            </a>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function BookingHistoryList({ entries }: { entries: BookingHistoryEntry[] }) {
  if (!entries.length) {
    return <p className="text-xs text-muted">No booking history.</p>;
  }
  return (
    <ul className="space-y-1 text-xs text-muted">
      {[...entries].reverse().map((e, i) => (
        <li key={`${e.changed_at}-${i}`}>
          {e.cancelled_at
            ? `Cancelled${e.reason ? ` · ${e.reason}` : ""} · was ${formatISTDateTime(e.previous_scheduled_for)}`
            : `${formatISTDateTime(e.previous_scheduled_for)} → ${formatISTDateTime(e.new_scheduled_for)}`}
        </li>
      ))}
    </ul>
  );
}
