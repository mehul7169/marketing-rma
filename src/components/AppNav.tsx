import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionRole } from "@/lib/auth/session";
import AppNavClient from "@/components/AppNavClient";

export default async function AppNav() {
  const role = await parseSessionRole(
    cookies().get(SESSION_COOKIE)?.value,
    process.env.ROLE_SECRET
  );

  return <AppNavClient role={role} />;
}
