import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isRole, type Role } from "@/lib/auth/session";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function roleCookieValue(role: Role): string {
  const secret = process.env.ROLE_SECRET ?? "";
  if (!secret) throw new Error("Missing ROLE_SECRET");
  const hmac = createHmac("sha256", secret).update(role).digest("hex");
  return `${role}.${hmac}`;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const viewerEmail = process.env.VIEWER_EMAIL ?? "";
  const viewerPassword = process.env.VIEWER_PASSWORD ?? "";

  let role: Role | null = null;
  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    role = "admin";
  } else if (
    viewerEmail &&
    viewerPassword &&
    email === viewerEmail &&
    password === viewerPassword
  ) {
    role = "viewer";
  }

  if (!role || !isRole(role)) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  let cookieValue: string;
  try {
    cookieValue = roleCookieValue(role);
  } catch {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}
