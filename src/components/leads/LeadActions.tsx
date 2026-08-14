"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadRow } from "@/lib/leads/types";
import { saveLeadActions } from "@/app/leads/actions";
import { formatCurrencyNullable } from "@/lib/format";

function TriToggle({
  label,
  value,
  onChange,
  yes = "Yes",
  no = "No",
  unset = "Not yet"
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yes?: string;
  no?: string;
  unset?: string;
}) {
  const btn = (v: boolean | null, text: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`rounded border px-3 py-1.5 text-sm ${
        value === v
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 text-slate-700"
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="flex flex-wrap gap-2">
        {btn(true, yes)}
        {btn(false, no)}
        {btn(null, unset)}
      </div>
    </div>
  );
}

function BoolToggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded border px-3 py-1.5 text-sm ${value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
        >
          On
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded border px-3 py-1.5 text-sm ${!value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
        >
          Off
        </button>
      </div>
    </div>
  );
}

export default function LeadActions({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [dealValue, setDealValue] = useState(
    lead.deal_value !== null && lead.deal_value !== undefined
      ? String(lead.deal_value)
      : ""
  );
  const [dealClosed, setDealClosed] = useState(lead.deal_closed);
  const [saving, setSaving] = useState(false);

  async function patch(input: Parameters<typeof saveLeadActions>[1]) {
    setError(null);
    setSaving(true);
    try {
      await saveLeadActions(lead.id, input);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <TriToggle
        label="Qualified"
        value={lead.qualified}
        yes="Qualified"
        no="Unqualified"
        unset="Not yet decided"
        onChange={(qualified) => patch({ qualified })}
      />
      <BoolToggle
        label="Setter verified"
        value={Boolean(lead.setter_verified)}
        onChange={(setter_verified) => patch({ setter_verified })}
      />
      <BoolToggle
        label="Reminder sent"
        value={Boolean(lead.reminder_sent)}
        onChange={(reminder_sent) => patch({ reminder_sent })}
      />
      <TriToggle
        label="Call showed"
        value={lead.call_showed}
        yes="Showed"
        no="No-show"
        unset="Not yet happened"
        onChange={(call_showed) => patch({ call_showed })}
      />
      <TriToggle
        label="Deal"
        value={lead.deal_closed}
        yes="Won"
        no="Lost"
        unset="Not yet decided"
        onChange={(deal_closed) => {
          setDealClosed(deal_closed);
          if (deal_closed === true) {
            const n = dealValue.trim() === "" ? null : Number(dealValue);
            patch({
              deal_closed,
              deal_value: n !== null && Number.isFinite(n) ? n : lead.deal_value
            });
          } else {
            patch({ deal_closed });
          }
        }}
      />
      {dealClosed === true ? (
        <label className="block text-xs text-slate-600">
          Deal value
          <input
            type="number"
            min={0}
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
            onBlur={() => {
              const n = dealValue.trim() === "" ? null : Number(dealValue);
              patch({ deal_value: n !== null && Number.isFinite(n) ? n : null });
            }}
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-slate-500">
            Current: {formatCurrencyNullable(lead.deal_value)}
          </span>
        </label>
      ) : null}

      <label className="block text-xs text-slate-600">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
        />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={() => patch({ notes })}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save notes"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
