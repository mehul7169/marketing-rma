import Link from "next/link";
import { notFound } from "next/navigation";
import InviteMemberForm from "@/components/admin/InviteMemberForm";
import { requirePlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { listMembershipsForOrg } from "@/lib/db/memberships";
import { getOrganizationById } from "@/lib/db/organizations";

function StatusBadge({ status }: { status: "active" | "invited" }) {
  if (status === "active") {
    return (
      <span className="inline-flex rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      Invited — awaiting first login
    </span>
  );
}

export default async function AdminOrganizationDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requirePlatformAdmin();
  const org = await getOrganizationById(params.id);
  if (!org) notFound();

  const members = await listMembershipsForOrg(org.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/organizations"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Organizations
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          {org.name}
        </h1>
        <p className="mt-1 font-mono text-sm text-slate-500">{org.slug}</p>
      </div>

      <InviteMemberForm orgId={org.id} />

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {members.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-slate-500">
                  No members yet. Invite someone above.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-slate-900">{m.email}</td>
                  <td className="px-4 py-3 text-slate-600">{m.role}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
