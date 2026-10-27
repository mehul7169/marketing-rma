"use client";

import { useCallback, useEffect, useState } from "react";
import {
  leadLifecycleAction,
  saveLeadPlainFieldsAction
} from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import type { LeadCellEditHandlers } from "@/components/table-views/leadColumnCells";
import { useLeadDrawerParam } from "@/components/leads/useLeadDrawerParam";
import { lifecycleBlockReason } from "@/lib/leads/gridGuards";
import {
  planLifecycle,
  type LifecycleAction,
  type LifecyclePayload
} from "@/lib/leads/lifecycle";
import { predictLogCallAttemptPatch } from "@/lib/leads/predictCallAttempt";
import type { DeadReasonCode, LeadRow } from "@/lib/leads/types";
import { fromDatetimeLocalIST } from "@/lib/timezone";

export type GridConfirm = {
  lead: LeadRow;
  columnId: string;
  action: LifecycleAction;
  payload: LifecyclePayload;
  title: string;
  message: string;
  reasonRequired?: boolean;
  reasonLabel?: string;
  showDeadReason?: boolean;
  confirmLabel?: string;
};

export type GridConfirmSpec = Omit<GridConfirm, "lead">;

function cellKey(leadId: string, columnId: string): string {
  return `${leadId}:${columnId}`;
}

export function useLeadGrid(
  initialRows: LeadRow[],
  opts?: { belongs?: (lead: LeadRow) => boolean }
) {
  const preview = useOrgPreview();
  const drawer = useLeadDrawerParam();
  const [rows, setRows] = useState(initialRows);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<GridConfirm | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const belongs = opts?.belongs;

  const applyLead = useCallback(
    (leadId: string, next: LeadRow | Partial<LeadRow>) => {
      setRows((prev) => {
        const idx = prev.findIndex((l) => l.id === leadId);
        if (idx === -1) {
          const incoming = next as LeadRow;
          if (!incoming?.id) return prev;
          const ok = belongs ? belongs(incoming) : true;
          return ok ? [incoming, ...prev] : prev;
        }
        const merged = { ...prev[idx], ...(next as Partial<LeadRow>) };
        const ok = belongs ? belongs(merged) : true;
        if (!ok) return prev.filter((l) => l.id !== leadId);
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      });
    },
    [belongs]
  );

  const restore = useCallback((snapshot: LeadRow) => {
    setRows((prev) => {
      const idx = prev.findIndex((l) => l.id === snapshot.id);
      if (idx === -1) return [snapshot, ...prev];
      const copy = [...prev];
      copy[idx] = snapshot;
      return copy;
    });
  }, []);

  const setCellError = useCallback(
    (leadId: string, columnId: string, message: string | null) => {
      setErrors((prev) => {
        const key = cellKey(leadId, columnId);
        if (!message) {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: message };
      });
    },
    []
  );

  const runLifecycle = useCallback(
    (
      lead: LeadRow,
      action: LifecycleAction,
      payload: LifecyclePayload = {},
      columnId = "stage"
    ) => {
      if (preview.active) return;
      const blocked = lifecycleBlockReason(lead, action, payload);
      if (blocked) {
        setCellError(lead.id, columnId, blocked);
        return;
      }
      let optimistic: Partial<LeadRow> | null = null;
      if (action === "log_call_attempt" && payload.outcome) {
        optimistic = predictLogCallAttemptPatch(lead, payload.outcome, {
          followUpAtIso: payload.followUpAt ?? null,
          scheduledForIso: payload.scheduledFor ?? null
        });
      } else {
        const plan = planLifecycle(lead, action, payload, {
          userId: null,
          email: null
        });
        if (plan.ok) optimistic = plan.patch;
      }
      if (optimistic) applyLead(lead.id, optimistic);
      setCellError(lead.id, columnId, null);
      void leadLifecycleAction(lead.id, action, payload)
        .then((res) => {
          if (!res.ok) {
            restore(lead);
            setCellError(lead.id, columnId, res.error);
            return;
          }
          applyLead(lead.id, res.lead);
        })
        .catch((err) => {
          restore(lead);
          setCellError(
            lead.id,
            columnId,
            err instanceof Error ? err.message : "Save failed"
          );
        });
    },
    [applyLead, preview.active, restore, setCellError]
  );

  const requestConfirm = useCallback((lead: LeadRow, spec: GridConfirmSpec) => {
    setConfirm({ lead, ...spec });
  }, []);

  const resolveConfirm = useCallback(
    (opts: { reason?: string; deadReason?: DeadReasonCode | null }) => {
      if (!confirm) return;
      const { lead, action, payload, columnId } = confirm;
      setConfirm(null);
      runLifecycle(
        lead,
        action,
        {
          ...payload,
          reason: opts.reason ?? payload.reason,
          deadReason: opts.deadReason ?? payload.deadReason
        },
        columnId
      );
    },
    [confirm, runLifecycle]
  );

  const commitPlainField = useCallback(
    (
      lead: LeadRow,
      field: "notes" | "deal_value" | "call_scheduled_for",
      raw: string
    ) => {
      if (preview.active) return;
      const previous = lead;
      let patch: Partial<LeadRow> = {};
      let serverInput: Parameters<typeof saveLeadPlainFieldsAction>[1] = {};

      if (field === "deal_value") {
        const trimmed = raw.trim();
        const num = trimmed === "" ? null : Number(trimmed);
        if (trimmed !== "" && !Number.isFinite(num)) {
          setCellError(lead.id, field, "Deal value must be a number");
          return;
        }
        patch = { deal_value: num };
        serverInput = { deal_value: num };
      } else if (field === "call_scheduled_for") {
        const trimmed = raw.trim();
        if (!trimmed) {
          if (!lead.call_booked_at) return;
          requestConfirm(lead, {
            columnId: "call_scheduled_for",
            action: "cancel_call",
            payload: {},
            title: "Cancel call",
            message: "Clearing the scheduled time cancels the booking.",
            reasonRequired: true,
            reasonLabel: "Why is this call being cancelled?",
            confirmLabel: "Cancel call"
          });
          return;
        }
        let iso: string;
        try {
          iso = fromDatetimeLocalIST(trimmed);
        } catch {
          setCellError(lead.id, field, "Invalid date/time");
          return;
        }
        patch = { call_scheduled_for: iso };
        serverInput = { call_scheduled_for: iso };
      } else {
        const v = raw.trim() || null;
        patch = { notes: v };
        serverInput = { notes: v };
      }

      applyLead(lead.id, patch);
      setCellError(lead.id, field, null);
      void saveLeadPlainFieldsAction(lead.id, serverInput)
        .then((res) => {
          if (!res.ok) {
            restore(previous);
            setCellError(lead.id, field, res.error);
            return;
          }
          applyLead(lead.id, res.lead);
        })
        .catch((err) => {
          restore(previous);
          setCellError(
            lead.id,
            field,
            err instanceof Error ? err.message : "Save failed"
          );
        });
    },
    [applyLead, preview.active, requestConfirm, restore, setCellError]
  );

  const commitCustomField = useCallback(
    (lead: LeadRow, key: string, raw: string) => {
      if (preview.active) return;
      const previous = lead;
      const custom_fields = {
        ...(lead.custom_fields ?? {}),
        [key]: raw.trim() || null
      };
      applyLead(lead.id, { custom_fields });
      const columnId = `custom_fields.${key}`;
      setCellError(lead.id, columnId, null);
      void saveLeadPlainFieldsAction(lead.id, {
        custom_fields: { [key]: raw.trim() || null }
      })
        .then((res) => {
          if (!res.ok) {
            restore(previous);
            setCellError(lead.id, columnId, res.error);
            return;
          }
          applyLead(lead.id, res.lead);
        })
        .catch((err) => {
          restore(previous);
          setCellError(
            lead.id,
            columnId,
            err instanceof Error ? err.message : "Save failed"
          );
        });
    },
    [applyLead, preview.active, restore, setCellError]
  );

  const editHandlersFor = useCallback(
    (lead: LeadRow): LeadCellEditHandlers => ({
      disabled: preview.active,
      onPlainField: (field, value) => {
        if (
          field === "notes" ||
          field === "deal_value" ||
          field === "call_scheduled_for"
        ) {
          commitPlainField(lead, field, value);
        }
      },
      onCustomField: (key, value) => commitCustomField(lead, key, value),
      onLifecycle: (action, payload) => runLifecycle(lead, action, payload),
      onConfirm: (spec) => requestConfirm(lead, spec),
      onOpenDrawer: () => drawer.open(lead.id),
      cellError: (columnId) => errors[cellKey(lead.id, columnId)] ?? null
    }),
    [
      commitCustomField,
      commitPlainField,
      drawer,
      errors,
      preview.active,
      requestConfirm,
      runLifecycle
    ]
  );

  return {
    rows,
    preview,
    confirm,
    setConfirm,
    resolveConfirm,
    editHandlersFor,
    runLifecycle,
    requestConfirm,
    applyLead,
    restore,
    openDrawer: drawer.open
  };
}
