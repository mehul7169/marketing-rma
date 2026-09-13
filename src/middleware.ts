import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api/cron, api/ingest (secret-header auth, unchanged)
     * - Next static assets / favicon / public files (svg, png, …)
     *   Without this, /run-more-ads-logo.svg is redirected to /login HTML
     *   and the nav logo shows as a broken image for logged-out users.
     */
    "/((?!api/cron|api/ingest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
