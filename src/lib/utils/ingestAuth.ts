import type { NextRequest } from "next/server";

function getBearer(req: NextRequest): string {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return authHeader?.trim() ?? "";
}

export function assertWebsiteIngestSecret(req: NextRequest) {
  const secret = process.env.WEBSITE_INGEST_SECRET;
  if (!secret) throw new Error("Missing WEBSITE_INGEST_SECRET");
  if (getBearer(req) !== secret) {
    throw new Error("Unauthorized ingest");
  }
}

/** Google Apps Script QuickForm ingest — uses x-ingest-secret header. */
export function assertQuickformIngestSecret(req: NextRequest) {
  const secret = process.env.QUICKFORM_INGEST_SECRET;
  if (!secret) throw new Error("Missing QUICKFORM_INGEST_SECRET");
  const provided = req.headers.get("x-ingest-secret")?.trim() ?? "";
  if (!provided || provided !== secret) {
    throw new Error("Unauthorized ingest");
  }
}
