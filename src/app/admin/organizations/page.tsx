import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { listOrganizations } from "@/lib/db/organizations";
import { formatISTDateTime } from "@/lib/timezone";
import CreateOrganizationForm from "@/components/admin/CreateOrganizationForm";

export default async function AdminOrganizationsPage() {
  await requirePlatformAdmin();
  const orgs = await listOrganizations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Organizations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Platform admin — create orgs and invite members.
        </p>
      </div>

      <CreateOrganizationForm />

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  No organizations yet.
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {org.slug}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatISTDateTime(org.created_at)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {org.member_count}
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
