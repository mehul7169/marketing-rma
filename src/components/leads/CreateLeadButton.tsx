"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION_OFF, transitionBase } from "@/lib/motion";
import { usePathname, useSearchParams } from "next/navigation";
import { withLeadParam } from "@/lib/leads/leadHref";
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
  const pathname = usePathname();
  const search = useSearchParams();
  const reduced = useReducedMotion();
  const skipMotion = MOTION_OFF || reduced;

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
    `mt-1 w-full rounded border px-3 py-2 text-sm text-fg ${
      err ? "border-danger" : "border-subtle"
    }`;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? ORG_PREVIEW_READ_ONLY_MESSAGE : undefined}
        onClick={() => setOpen(true)}
        aria-label="Create Lead"
        className="btn-brand inline-flex h-8 items-center gap-1.5 px-3 text-sm leading-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="max-[1024px]:hidden">Create Lead</span>
      </button>

      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting) close();
          }}
          initial={skipMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitionBase}
        >
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lead-title"
            onSubmit={onSubmit}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !submitting) close();
            }}
            noValidate
            className="w-full max-w-md space-y-4 rounded border border-subtle bg-surface p-5 shadow-card"
            initial={skipMotion ? false : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={transitionBase}
          >
            <div>
              <h2 id="create-lead-title" className="text-base font-medium text-fg">
                Create Lead
              </h2>
              <p className="mt-1 text-xs text-muted">
                For referrals and leads added by hand — not from ads or forms.
              </p>
            </div>

            <label className="block text-xs text-muted">
              Name *
              <input
                ref={nameRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass(fieldErrors.name)}
                autoComplete="off"
              />
              {fieldErrors.name ? (
                <span className="mt-1 block text-danger">{fieldErrors.name}</span>
              ) : null}
            </label>

            <label className="block text-xs text-muted">
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
                <span className="mt-1 block text-danger">{fieldErrors.phone}</span>
              ) : null}
            </label>

            <label className="block text-xs text-muted">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass(fieldErrors.email)}
                autoComplete="off"
              />
              <span className="mt-1 block text-muted">
                Optional — leave blank if unknown (shown as “No email”).
              </span>
              {fieldErrors.email ? (
                <span className="mt-1 block text-danger">{fieldErrors.email}</span>
              ) : null}
            </label>

            <label className="block text-xs text-muted">
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
                <span className="mt-1 block text-danger">{fieldErrors.source}</span>
              ) : null}
            </label>

            <label className="block text-xs text-muted">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className={inputClass()}
              />
            </label>

            {formError ? (
              <p className="text-sm text-danger" role="alert">
                {formError}{" "}
                {existingLeadId ? (
                  <a
                    href={withLeadParam(
                      pathname || "/leads",
                      search?.toString() ?? "",
                      existingLeadId
                    )}
                    className="underline decoration-danger underline-offset-2"
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
                className="rounded border border-subtle px-3 py-1.5 text-sm text-fg"
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
          </motion.form>
        </motion.div>
      ) : null}
    </>
  );
}
