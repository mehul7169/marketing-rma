import type { NextRequest } from "next/server";

function getHeader(req: NextRequest, name: string): string | null {
  const v = req.headers.get(name);
  return v ? v : null;
}

export function assertCronSecret(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("Missing CRON_SECRET");

  const authHeader = getHeader(req, "authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const xSecret = getHeader(req, "x-cron-secret");

  const incoming = bearer ?? xSecret ?? authHeader ?? "";
  if (incoming !== cronSecret) {
    const err: { message: string } = { message: "Unauthorized cron" };
    // Keep it simple; route handlers will map to 401.
    throw err;
  }
}

