"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addLeadFollowUp, markLeadFollowUpResolved } from "@/app/leads/actions";
import type { LeadReminder } from "@/lib/leads/types";
import { formatDueFriendly } from "@/lib/timezone";

function sortActive(a: LeadReminder, b: LeadReminder): number {
  if (!a.due_at && !b.due_at) return a.created_at < b.created_at ? 1 : -1;
  if (!a.due_at) return 1;
  if (!b.due_at) return -1;
  return a.due_at < b.due_at ? -1 : 1;
}

export default function LeadFollowUps({
  leadId,
  reminders
}: {
  leadId: string;
  reminders: LeadReminder[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => reminders.filter((r) => !r.resolved).sort(sortActive),
    [reminders]
  );
  const resolved = useMemo(
    () =>
      reminders
        .filter((r) => r.resolved)
        .sort((a, b) => (a.resolved_at ?? "") < (b.resolved_at ?? "") ? 1 : -1),
    [reminders]
  );

  async function add() {
    setError(null);
    setSaving(true);
    try {
      await addLeadFollowUp(leadId, text, due || null);
      setText("");
      setDue("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resolve(id: string) {
    setError(null);
    setSaving(true);
    try {
      await markLeadFollowUpResolved(id, leadId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {active.length === 0 ? (
        <p className="text-sm text-slate-500">No open follow-ups.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((r) => (
            <ReminderRow key={r.id} reminder={r} disabled={saving} onResolve={resolve} />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-slate-600">
          Add follow-up
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Call back at 5pm"
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-600">
          Due (IST, optional)
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={saving || !text.trim()}
          onClick={add}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>

      {resolved.length > 0 ? (
        <div>
          <button
            type="button"
            className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
          </button>
          {showResolved ? (
            <ul className="mt-2 space-y-2">
              {resolved.map((r) => (
                <ReminderRow key={r.id} reminder={r} disabled />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function ReminderRow({
  reminder,
  disabled,
  onResolve
}: {
  reminder: LeadReminder;
  disabled?: boolean;
  onResolve?: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded border border-slate-200 px-3 py-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={reminder.resolved}
        disabled={disabled || reminder.resolved || !onResolve}
        onChange={() => onResolve?.(reminder.id)}
        aria-label={reminder.resolved ? "Resolved" : "Mark resolved"}
      />
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${reminder.resolved ? "text-slate-500 line-through" : "text-slate-900"}`}>
          {reminder.text}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {formatDueFriendly(reminder.due_at)}
          {reminder.created_by ? ` · ${reminder.created_by}` : ""}
        </div>
      </div>
    </li>
  );
}
