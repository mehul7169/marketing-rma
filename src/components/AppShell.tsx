import { resolveCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { resolveOrgPreview } from "@/lib/auth/orgPreview";
import { getCurrentSession } from "@/lib/auth/session";
import { countLeads } from "@/lib/db/leads";
import { listOrganizations } from "@/lib/db/organizations";
import { overdueDealsFilters } from "@/lib/deals/dealListParams";
import AppShellClient from "@/components/AppShellClient";
import { OrgPreviewProvider } from "@/components/admin/OrgPreviewContext";

export default async function AppShell({
  children
}: {
  children: React.ReactNode;
}) {
  const [session, platformAdmin] = await Promise.all([
    getCurrentSession(),
    isPlatformAdmin()
  ]);

  const [preview, organizations, overdueDeals] = await Promise.all([
    platformAdmin ? resolveOrgPreview() : Promise.resolve(null),
    platformAdmin
      ? listOrganizations().then((orgs) =>
          orgs.map((o) => ({ id: o.id, name: o.name }))
        )
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    (async () => {
      try {
        const orgId = await resolveCurrentOrgId();
        if (!orgId) return 0;
        return countLeads(overdueDealsFilters(orgId));
      } catch {
        return 0;
      }
    })()
  ]);

  return (
    <OrgPreviewProvider
      previewOrgId={preview?.orgId ?? null}
      previewOrgName={preview?.orgName ?? null}
    >
      <AppShellClient
        signedIn={Boolean(session)}
        isPlatformAdmin={platformAdmin}
        organizations={organizations}
        previewOrgId={preview?.orgId ?? null}
        previewOrgName={preview?.orgName ?? null}
        overdueDeals={overdueDeals}
      >
        {children}
      </AppShellClient>
    </OrgPreviewProvider>
  );
}
