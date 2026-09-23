"use client";

import { useEffect, useRef, useState } from "react";
import { createManualLeadAction } from "@/app/leads/actions";
import { ORG_PREVIEW_READ_ONLY_MESSAGE } from "@/lib/auth/orgPreviewConstants";
import {
  MANUAL_LEAD_SOURCES,
  validateManualLead,
  type ManualLeadFieldErrors
} from "@/lib/leads/manualLead";
import type { LeadRow } from "@/lib/leads/types";

const EMPTY = { name: "", phone: "", email: "", source: "referral", notes: "" };

export default function CreateLeadButton({
  disabled,
  onCreated
}: {
  /** True during org preview (read-only). */
  disabled: boolean;
  onCreated: (lead: LeadRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<ManualLeadFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existingLeadId, setExistingLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setForm(EMPTY);
    setFieldErrors({});
    setFormError(null);
    setExistingLeadId(null);
  }

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setExistingLeadId(null);
    const local = validateManualLead(form);
    if (!local.ok) {
      setFieldErrors(local.errors);
      return;
    }
    setSubmitting(true);
    try {
      const res = await createManualLeadAction(form);
      if (!res.ok) {
        setFormError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setExistingLeadId(res.existingLeadId ?? null);
        return;
      }
      onCreated(res.lead);
      close();
    } catch {
      setFormError("Could not create the lead. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (err?: string) =>
    `mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900 ${
      err ? "border-red-400" : "border-slate-200"
    }`;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? ORG_PREVIEW_READ_ONLY_MESSAGE : undefined}
        onClick={() => setOpen(true)}
        className="btn-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create Lead
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting) close();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lead-title"
            onSubmit={onSubmit}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !submitting) close();
            }}
            noValidate
            className="w-full max-w-md space-y-4 rounded border border-slate-200 bg-white p-5 shadow-lg"
          >
            <div>
              <h2 id="create-lead-title" className="text-base font-medium text-slate-900">
                Create Lead
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                For referrals and leads added by hand — not from ads or forms.
              </p>
            </div>

            <label className="block text-xs text-slate-600">
              Name *
              <input
                ref={nameRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass(fieldErrors.name)}
                autoComplete="off"
              />
              {fieldErrors.name ? (
                <span className="mt-1 block text-red-600">{fieldErrors.name}</span>
              ) : null}
            </label>

            <label className="block text-xs text-slate-600">
              Phone *
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91…"
                className={inputClass(fieldErrors.phone)}
                autoComplete="off"
              />
              {fieldErrors.phone ? (
                <span className="mt-1 block text-red-600">{fieldErrors.phone}</span>
              ) : null}
            </label>

            <label className="block text-xs text-slate-600">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass(fieldErrors.email)}
                autoComplete="off"
              />
              <span className="mt-1 block text-slate-500">
                Optional — leave blank if unknown (shown as “No email”).
              </span>
              {fieldErrors.email ? (
                <span className="mt-1 block text-red-600">{fieldErrors.email}</span>
              ) : null}
            </label>

            <label className="block text-xs text-slate-600">
              Source *
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                className={inputClass(fieldErrors.source)}
              >
                {MANUAL_LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {fieldErrors.source ? (
                <span className="mt-1 block text-red-600">{fieldErrors.source}</span>
              ) : null}
            </label>

            <label className="block text-xs text-slate-600">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className={inputClass()}
              />
            </label>

            {formError ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}{" "}
                {existingLeadId ? (
                  <a
                    href={`/leads/${existingLeadId}`}
                    className="underline decoration-red-300 underline-offset-2"
                  >
                    Open existing lead
                  </a>
                ) : null}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={close}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-brand disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create lead"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
