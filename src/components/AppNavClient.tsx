"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <a
      href={href}
      className={
        active
          ? "ui-active rounded px-2 py-1 text-sm"
          : "rounded px-2 py-1 text-sm text-slate-600 hover:text-slate-900"
      }
    >
      {children}
    </a>
  );
}

export default function AppNavClient({
  signedIn,
  isPlatformAdmin
}: {
  signedIn: boolean;
  isPlatformAdmin: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);

  // Platform admins without org membership still need nav (logout + orgs).
  if (!signedIn && !isPlatformAdmin) return null;

  async function onLogout() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2">
      {signedIn ? (
        <>
          <NavLink href="/">Home</NavLink>
          <NavLink href="/leads">Leads</NavLink>
          <NavLink href="/insights">Insights</NavLink>
          <NavLink href="/meta-ads">Meta Ads</NavLink>
          <NavLink href="/website">Website</NavLink>
        </>
      ) : null}
      {isPlatformAdmin ? (
        <>
          {signedIn ? <NavLink href="/clients-ads">Client Ads</NavLink> : null}
          <NavLink href="/admin/organizations">Organizations</NavLink>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={signingOut}
        className="rounded px-2 py-1 text-slate-600 hover:text-slate-900 disabled:opacity-60"
      >
        {signingOut ? "Logging out…" : "Log out"}
      </button>
    </nav>
  );
}
