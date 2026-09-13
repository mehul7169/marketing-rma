"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inviteMemberAction } from "@/app/admin/organizations/actions";
import type { Role } from "@/lib/auth/session";

export default function InviteMemberForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await inviteMemberAction(orgId, email, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail("");
      setRole("viewer");
      setShowForm(false);
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
        {showForm ? "Cancel" : "Invite member"}
      </button>

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="max-w-md space-y-3 rounded border border-slate-200 bg-slate-50 p-4"
        >
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
            </select>
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
            {submitting ? "Inviting…" : "Invite"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
