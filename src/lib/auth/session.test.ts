import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser }
  })
}));

vi.mock("@/lib/db/supabaseAdmin", () => ({
  supabaseAdmin: null
}));

import { getActorEmail, getActorUserId, getCurrentSession } from "@/lib/auth/session";

describe("session actor helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCurrentSession returns userId and email", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uuid-abc", email: "a@b.com" } }
    });
    await expect(getCurrentSession()).resolves.toEqual({
      userId: "uuid-abc",
      email: "a@b.com"
    });
  });

  it("getActorUserId returns auth uid, never email", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uuid-abc", email: "a@b.com" } }
    });
    await expect(getActorUserId()).resolves.toBe("uuid-abc");
  });

  it("getActorUserId throws when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(getActorUserId()).rejects.toThrow("Unauthorized");
  });

  it("getActorEmail is for text audit fields only", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uuid-abc", email: "a@b.com" } }
    });
    await expect(getActorEmail()).resolves.toBe("a@b.com");
  });
});
