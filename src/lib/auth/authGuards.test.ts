import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path)
}));

const getUser = vi.fn();
const membershipMaybeSingle = vi.fn();
const profileMaybeSingle = vi.fn();
const orgMaybeSingle = vi.fn();
const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: cookieGet
  })
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser }
  })
}));

vi.mock("@/lib/db/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "memberships") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: membershipMaybeSingle
              })
            })
          })
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: profileMaybeSingle
            })
          })
        };
      }
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: orgMaybeSingle
            })
          })
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  }
}));

import {
  getCurrentOrgId,
  requireOrgId,
  requireWritableOrgId,
  resolveCurrentOrgId
} from "@/lib/auth/getCurrentOrgId";
import {
  isPlatformAdmin,
  requirePlatformAdmin
} from "@/lib/auth/isPlatformAdmin";
import { ORG_PREVIEW_READ_ONLY_MESSAGE } from "@/lib/auth/orgPreviewConstants";

describe("getCurrentOrgId / resolveCurrentOrgId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue(undefined);
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await resolveCurrentOrgId()).toBeNull();
  });

  it("returns null when membership is missing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    membershipMaybeSingle.mockResolvedValue({ data: null, error: null });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: false },
      error: null
    });
    expect(await resolveCurrentOrgId()).toBeNull();
  });

  it("returns org_id when membership exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    membershipMaybeSingle.mockResolvedValue({
      data: { org_id: "org-99" },
      error: null
    });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: false },
      error: null
    });
    expect(await resolveCurrentOrgId()).toBe("org-99");
  });

  it("platform admin with valid preview cookie skips membership", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin" } } });
    cookieGet.mockReturnValue({ value: "preview-org" });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: true },
      error: null
    });
    orgMaybeSingle.mockResolvedValue({
      data: {
        id: "preview-org",
        name: "Client Co",
        slug: "client",
        created_at: "2026-01-01"
      },
      error: null
    });
    expect(await resolveCurrentOrgId()).toBe("preview-org");
    expect(membershipMaybeSingle).not.toHaveBeenCalled();
  });

  it("ignores preview cookie for non–platform-admins (security)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "member" } } });
    cookieGet.mockReturnValue({ value: "preview-org" });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: false },
      error: null
    });
    membershipMaybeSingle.mockResolvedValue({
      data: { org_id: "own-org" },
      error: null
    });
    expect(await resolveCurrentOrgId()).toBe("own-org");
    expect(orgMaybeSingle).not.toHaveBeenCalled();
  });

  it("getCurrentOrgId redirects to /login without org", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(getCurrentOrgId()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("requireOrgId throws Unauthorized without org", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireOrgId()).rejects.toThrow("Unauthorized");
  });

  it("requireWritableOrgId blocks while previewing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin" } } });
    cookieGet.mockReturnValue({ value: "preview-org" });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: true },
      error: null
    });
    orgMaybeSingle.mockResolvedValue({
      data: {
        id: "preview-org",
        name: "Client Co",
        slug: "client",
        created_at: "2026-01-01"
      },
      error: null
    });
    await expect(requireWritableOrgId()).rejects.toThrow(
      ORG_PREVIEW_READ_ONLY_MESSAGE
    );
  });
});

describe("isPlatformAdmin / requirePlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue(undefined);
  });

  it("returns false with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await isPlatformAdmin()).toBe(false);
  });

  it("returns true when profile flag is set", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: true },
      error: null
    });
    expect(await isPlatformAdmin()).toBe(true);
  });

  it("requirePlatformAdmin redirects non-admins home", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    profileMaybeSingle.mockResolvedValue({
      data: { is_platform_admin: false },
      error: null
    });
    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
