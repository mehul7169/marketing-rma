import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { getCurrentSession } from "@/lib/auth/session";
import AppNavClient from "@/components/AppNavClient";

export default async function AppNav() {
  const [session, platformAdmin] = await Promise.all([
    getCurrentSession(),
    isPlatformAdmin()
  ]);
  return (
    <AppNavClient
      signedIn={Boolean(session)}
      isPlatformAdmin={platformAdmin}
    />
  );
}
