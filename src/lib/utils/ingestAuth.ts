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
