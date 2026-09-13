"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOrganizationAction } from "@/app/admin/organizations/actions";
import { formatOrgSlug } from "@/lib/orgs/formatOrgSlug";

export default function CreateOrganizationForm() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createOrganizationAction(name, slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setSlug("");
      setSlugTouched(false);
      setShowForm(false);
      router.push(`/admin/organizations/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setShowForm((v) => !v);
          setError(null);
        }}
        className="ui-btn-primary rounded px-3 py-2 text-sm"
      >
        {showForm ? "Cancel" : "Create organization"}
      </button>

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="max-w-md space-y-3 rounded border border-slate-200 bg-slate-50 p-4"
        >
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (!slugTouched) setSlug(formatOrgSlug(next));
              }}
              required
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Slug
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(formatOrgSlug(e.target.value));
              }}
              required
              spellCheck={false}
              className="rounded border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="btn-brand rounded px-3 py-2 text-sm disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
