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
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Toaster } from "@/components/ui/Toast";
import CountUp from "@/components/ui/CountUp";
import { cn } from "@/components/ui/cn";
import { createClient } from "@/lib/supabase/client";

const SIDEBAR_KEY = "sidebar-collapsed";

function NavIcon({ d, collapsed }: { d: string; collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-3.5 w-3.5")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  Home: "M2.5 7.5 8 2.5l5.5 5M4 7v6.5h8V7",
  Leads: "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 13.5c.5-2 2.4-3.5 5-3.5s4.5 1.5 5 3.5",
  "Work Queue": "M3 3.5h10M3 8h10M3 12.5h6",
  Deals: "M3 5.5h10v7H3zM5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5",
  Insights: "M3 12.5V8.5M8 12.5V3.5M13 12.5V6.5",
  "Meta Ads": "M3 12.5 6.5 6l2.5 4 1.5-2.5 2.5 5",
  Website: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2.5 8h11M8 2.5c1.8 1.8 1.8 9.2 0 11M8 2.5c-1.8 1.8-1.8 9.2 0 11",
  "Client Ads": "M3 4.5h4v7H3zM9 4.5h4v4H9z",
  Organizations: "M3 13.5V6l5-3 5 3v7.5M6 13.5v-4h4v4"
};

function NavLink({
  href,
  children,
  collapsed,
  badge,
  testId
}: {
  href: string;
  children: string;
  collapsed: boolean;
  badge?: number;
  testId?: string;
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
      data-testid={testId}
      className={cn(
        "flex items-center gap-2.5 rounded-pill px-2.5 py-1.5 text-sm",
        active
          ? "bg-accent-soft font-medium text-fg"
          : "text-muted hover:bg-surface-2 hover:text-fg",
        collapsed ? "relative justify-center px-2" : ""
      )}
    >
      <NavIcon d={ICONS[children] ?? ICONS.Home} collapsed={collapsed} />
      {collapsed ? null : <span className="min-w-0 flex-1 truncate">{children}</span>}
      {badge ? (
        <span
          data-testid="nav-deals-overdue"
          className={cn(
            "inline-flex min-w-[1.15rem] items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-fg",
            collapsed ? "absolute right-0.5 top-0.5" : ""
          )}
        >
          <CountUp
            value={badge}
            format={(n) => (n > 99 ? "99+" : String(Math.round(n)))}
            speed="badge"
          />
        </span>
      ) : null}
    </a>
  );
}

export default function AppShellClient({
  signedIn,
  isPlatformAdmin,
  organizations = [],
  previewOrgId = null,
  previewOrgName = null,
  overdueDeals = 0,
  children
}: {
  signedIn: boolean;
  isPlatformAdmin: boolean;
  organizations?: Array<{ id: string; name: string }>;
  previewOrgId?: string | null;
  previewOrgName?: string | null;
  overdueDeals?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isDev = pathname.startsWith("/dev");
  const showNav = (signedIn || isPlatformAdmin) && !isDev;
  const showOrgNav = signedIn || Boolean(previewOrgId);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
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

  const isCollapsed = hydrated ? collapsed : false;

  if (isDev) {
    return <div className="min-h-dvh bg-page text-fg">{children}</div>;
  }

  if (!showNav) {
    return (
      <div className="flex h-dvh flex-col">
        <header className="shrink-0 border-b border-subtle bg-surface">
          <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
            <a href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/run-more-ads-logo.svg"
                alt="Run More Ads"
                className="logo-mark h-8 w-auto"
                height={32}
              />
              <span className="text-xs font-medium tracking-wide text-muted">
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
    <div className="flex h-dvh bg-page">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-subtle bg-surface transition-[width] duration-150",
          isCollapsed ? "w-14" : "w-48"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b border-subtle px-2 py-3",
            isCollapsed ? "justify-center" : "px-3"
          )}
        >
          <a href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/run-more-ads-logo.svg"
                alt="Run More Ads"
                className="logo-mark h-6 w-auto shrink-0"
                height={24}
              />
            {!isCollapsed ? (
              <span className="truncate text-label uppercase text-muted">
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
              <NavLink
                href="/deals"
                collapsed={isCollapsed}
                badge={overdueDeals}
                testId="nav-deals"
              >
                Deals
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

        <div className="space-y-2 border-t border-subtle p-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "w-full rounded-pill px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg",
              isCollapsed ? "text-center" : ""
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? "»" : "« Collapse"}
          </button>
          {isPlatformAdmin ? (
            <div className={isCollapsed ? "hidden" : ""}>
              <OrgPreviewSwitcher
                organizations={organizations}
                previewOrgId={previewOrgId}
              />
            </div>
          ) : null}
          <ThemeToggle collapsed={isCollapsed} />
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={signingOut}
            className={cn(
              "w-full rounded-pill px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-60",
              isCollapsed ? "text-center text-[11px] font-medium" : ""
            )}
            title="Log out"
          >
            {signingOut ? "…" : isCollapsed ? "Out" : "Log out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
            {previewOrgName ? (
              <OrgPreviewBanner orgName={previewOrgName} />
            ) : null}
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
