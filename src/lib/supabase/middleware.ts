import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

const PREVIEW_ORG_COOKIE = "preview_org_id";

async function userHasMembership(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data?.org_id) return false;
  return true;
}

async function platformAdminForUserId(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.is_platform_admin === true;
}

/** Cross-org surfaces — platform admin only. */
function isPlatformAdminOnlyPath(pathname: string): boolean {
  return (
    pathname === "/admin/organizations" ||
    pathname.startsWith("/admin/organizations/") ||
    pathname === "/clients-ads" ||
    pathname.startsWith("/clients-ads/")
  );
}

function withCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
  return to;
}

/**
 * Refresh the Supabase Auth session cookie and enforce access:
 * - org membership → full org-scoped app
 * - is_platform_admin → also /admin/organizations + /clients-ads
 * - is_platform_admin + preview_org_id cookie → org-scoped pages without membership
 * profiles.role is not used for access decisions.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");
  const isSignup = pathname === "/signup" || pathname.startsWith("/signup/");
  const isForgotPassword =
    pathname === "/forgot-password" || pathname.startsWith("/forgot-password/");
  const isResetPassword =
    pathname === "/reset-password" || pathname.startsWith("/reset-password/");
  // Password recovery must stay reachable even with a session: the recovery
  // link establishes a temporary session before updateUser({ password }).
  const isPasswordRecoveryPage = isForgotPassword || isResetPassword;
  const isAuthPage = isLogin || isSignup;

  if (!user) {
    if (isAuthPage || isPasswordRecoveryPage) return supabaseResponse;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [hasMembership, isPlatformAdmin] = await Promise.all([
    userHasMembership(user.id),
    platformAdminForUserId(user.id)
  ]);

  // Cookie alone is not enough — only platform admins may use preview access.
  const hasPreviewCookie = Boolean(
    request.cookies.get(PREVIEW_ORG_COOKIE)?.value?.trim()
  );
  const previewingAsAdmin = isPlatformAdmin && hasPreviewCookie;

  if (isPasswordRecoveryPage) {
    return supabaseResponse;
  }

  if (isAuthPage) {
    if (!hasMembership && !isPlatformAdmin) {
      // Authenticated but no org and not platform admin — stay on auth page.
      return supabaseResponse;
    }
    const dest =
      !hasMembership && isPlatformAdmin && !previewingAsAdmin
        ? "/admin/organizations"
        : "/";
    return withCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(dest, request.url))
    );
  }

  if (isPlatformAdminOnlyPath(pathname)) {
    if (!isPlatformAdmin) {
      return withCookies(
        supabaseResponse,
        NextResponse.redirect(new URL("/", request.url))
      );
    }
    // Platform-admin surfaces (/admin/organizations, /clients-ads) do not
    // require an org membership — access is gated by is_platform_admin only.
    return supabaseResponse;
  }

  if (!hasMembership) {
    if (previewingAsAdmin) {
      // Platform admin reviewing a client org without a real membership row.
      return supabaseResponse;
    }
    if (isPlatformAdmin) {
      return withCookies(
        supabaseResponse,
        NextResponse.redirect(new URL("/admin/organizations", request.url))
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Org member: full access to org-scoped pages (/, /leads, /meta-ads, …).
  return supabaseResponse;
}
