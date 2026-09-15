import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { resolveOrgPreview } from "@/lib/auth/orgPreview";
import { getCurrentSession } from "@/lib/auth/session";
import { listOrganizations } from "@/lib/db/organizations";
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

  const [preview, organizations] = platformAdmin
    ? await Promise.all([
        resolveOrgPreview(),
        listOrganizations().then((orgs) =>
          orgs.map((o) => ({ id: o.id, name: o.name }))
        )
      ])
    : [null, [] as Array<{ id: string; name: string }>];

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
      >
        {children}
      </AppShellClient>
    </OrgPreviewProvider>
  );
}
