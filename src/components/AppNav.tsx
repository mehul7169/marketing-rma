import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionRole } from "@/lib/auth/session";

export default async function AppNav() {
  const role = await parseSessionRole(
    cookies().get(SESSION_COOKIE)?.value,
    process.env.ROLE_SECRET
  );

  if (!role) return null;

  const link = "text-slate-600 hover:text-slate-900";

  return (
    <nav className="flex items-center gap-4 text-sm">
      {role === "admin" ? (
        <>
          <a className={link} href="/">
            Home
          </a>
          <a className={link} href="/leads">
            Leads
          </a>
        </>
      ) : null}
      <a className={link} href="/insights">
        Insights
      </a>
      <a className={link} href="/meta-ads">
        Meta Ads
      </a>
      <a className={link} href="/website">
        Website
      </a>
      <a className={link} href="/api/auth/logout">
        Log out
      </a>
    </nav>
  );
}
