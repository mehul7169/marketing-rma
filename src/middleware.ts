import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  isViewerAllowedPath,
  parseSessionRole
} from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const role = await parseSessionRole(session, process.env.ROLE_SECRET);

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (role === "admin") {
    return NextResponse.next();
  }

  if (isViewerAllowedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/meta-ads", request.url));
}

export const config = {
  matcher: [
    "/((?!api/cron|api/ingest|login|api/auth|_next/static|_next/image|favicon.ico).*)"
  ]
};
