export const SESSION_COOKIE = "session";

export type Role = "admin" | "viewer";

function hexFromBuffer(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return hexFromBuffer(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

export function isRole(value: string): value is Role {
  return value === "admin" || value === "viewer";
}

/** Same value as createHmac("sha256", ROLE_SECRET).update(role).digest("hex"). */
export async function signRole(role: Role, secret: string): Promise<string> {
  const hmac = await hmacSha256Hex(secret, role);
  return `${role}.${hmac}`;
}

export async function parseSessionRole(
  value: string | undefined,
  secret: string | undefined
): Promise<Role | null> {
  if (!value || !secret) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const role = value.slice(0, dot);
  const hmac = value.slice(dot + 1).toLowerCase();
  if (!isRole(role) || !hmac) return null;
  const expected = (await hmacSha256Hex(secret, role)).toLowerCase();
  if (!timingSafeEqual(hmac, expected)) return null;
  return role;
}

export function hasValidSession(value: string | undefined): boolean {
  return Boolean(value && value.includes("."));
}

export function actorEmailFromSession(_value: string | undefined): string {
  return process.env.ADMIN_EMAIL ?? "admin";
}

export function isViewerAllowedPath(pathname: string): boolean {
  return (
    pathname === "/meta-ads" ||
    pathname.startsWith("/meta-ads/") ||
    pathname === "/website" ||
    pathname.startsWith("/website/") ||
    pathname === "/insights" ||
    pathname.startsWith("/insights/")
  );
}
