"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/session";

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

export default function AppNavClient({ role }: { role: Role | null }) {
  if (!role) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2">
      {role === "admin" ? (
        <>
          <NavLink href="/">Home</NavLink>
          <NavLink href="/leads">Leads</NavLink>
        </>
      ) : null}
      <NavLink href="/insights">Insights</NavLink>
      <NavLink href="/meta-ads">Meta Ads</NavLink>
      <NavLink href="/website">Website</NavLink>
      <a
        className="rounded px-2 py-1 text-slate-600 hover:text-slate-900"
        href="/api/auth/logout"
      >
        Log out
      </a>
    </nav>
  );
}
