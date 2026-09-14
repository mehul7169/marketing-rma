import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { getCurrentSession } from "@/lib/auth/session";
import AppShellClient from "@/components/AppShellClient";

export default async function AppShell({
  children
}: {
  children: React.ReactNode;
}) {
  const [session, platformAdmin] = await Promise.all([
    getCurrentSession(),
    isPlatformAdmin()
  ]);
  return (
    <AppShellClient
      signedIn={Boolean(session)}
      isPlatformAdmin={platformAdmin}
    >
      {children}
    </AppShellClient>
  );
}
