"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import OrgPreviewBanner from "@/components/admin/OrgPreviewBanner";
import OrgPreviewSwitcher from "@/components/admin/OrgPreviewSwitcher";
import { createClient } from "@/lib/supabase/client";

const SIDEBAR_KEY = "sidebar-collapsed";

function shortLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return parts
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }
  return label.slice(0, 2);
}

function NavLink({
  href,
  children,
  collapsed
}: {
  href: string;
  children: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : href === "/leads"
        ? pathname === "/leads" || /^\/leads\/[^/]+$/.test(pathname)
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <a
      href={href}
      title={children}
      className={`block rounded px-3 py-2 text-sm ${
        active
          ? "ui-active"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      } ${collapsed ? "px-2 text-center text-[11px] font-medium tracking-wide" : ""}`}
    >
      {collapsed ? shortLabel(children) : children}
    </a>
  );
}

export default function AppShellClient({
  signedIn,
  isPlatformAdmin,
  organizations = [],
  previewOrgId = null,
  previewOrgName = null,
  children
}: {
  signedIn: boolean;
  isPlatformAdmin: boolean;
  organizations?: Array<{ id: string; name: string }>;
  previewOrgId?: string | null;
  previewOrgName?: string | null;
  children: ReactNode;
}) {
  const showNav = signedIn || isPlatformAdmin;
  // Previewing lets platform admins without membership use org nav.
  const showOrgNav = signedIn || Boolean(previewOrgId);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(sessionStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

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

  // Avoid flash of wrong width before sessionStorage read.
  const isCollapsed = hydrated ? collapsed : false;

  if (!showNav) {
    return (
      <div className="flex h-dvh flex-col">
        <header className="nav-brand-bar shrink-0 bg-white">
          <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
            <a href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/run-more-ads-logo.svg"
                alt="Run More Ads"
                className="h-8 w-auto"
                height={32}
              />
              <span className="text-xs font-medium tracking-wide text-slate-500">
                Dashboard
              </span>
            </a>
          </div>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto px-6 py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      <aside
        className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 ${
          isCollapsed ? "w-14" : "w-56"
        }`}
      >
        <div
          className={`nav-brand-bar flex items-center gap-2 border-b border-slate-100 px-3 py-4 ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <a href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/run-more-ads-logo.svg"
              alt="Run More Ads"
              className="h-7 w-auto shrink-0"
              height={28}
            />
            {!isCollapsed ? (
              <span className="truncate text-xs font-medium tracking-wide text-slate-500">
                Dashboard
              </span>
            ) : null}
          </a>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {showOrgNav ? (
            <>
              <NavLink href="/" collapsed={isCollapsed}>
                Home
              </NavLink>
              <NavLink href="/leads" collapsed={isCollapsed}>
                Leads
              </NavLink>
              <NavLink href="/leads/queue" collapsed={isCollapsed}>
                Work Queue
              </NavLink>
              <NavLink href="/insights" collapsed={isCollapsed}>
                Insights
              </NavLink>
              <NavLink href="/meta-ads" collapsed={isCollapsed}>
                Meta Ads
              </NavLink>
              <NavLink href="/website" collapsed={isCollapsed}>
                Website
              </NavLink>
            </>
          ) : null}
          {isPlatformAdmin ? (
            <>
              {showOrgNav ? (
                <NavLink href="/clients-ads" collapsed={isCollapsed}>
                  Client Ads
                </NavLink>
              ) : null}
              <NavLink href="/admin/organizations" collapsed={isCollapsed}>
                Organizations
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={signingOut}
            className={`w-full rounded px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 ${
              isCollapsed ? "px-2 text-center text-[11px] font-medium" : ""
            }`}
            title="Log out"
          >
            {signingOut ? "…" : isCollapsed ? "Out" : "Log out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={toggle}
            className="rounded border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            ☰
          </button>
          {isPlatformAdmin ? (
            <OrgPreviewSwitcher
              organizations={organizations}
              previewOrgId={previewOrgId}
            />
          ) : null}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
            {previewOrgName ? (
              <OrgPreviewBanner orgName={previewOrgName} />
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
