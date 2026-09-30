import { NextRequest, NextResponse } from "next/server";
import { requireOrgId } from "@/lib/auth/getCurrentOrgId";
import { getCurrentSession } from "@/lib/auth/session";
import { saveTableViewFilters } from "@/lib/db/table_views";
import {
  hasPersistedFilterKeys,
  pickPersistableFilters
} from "@/lib/table-views/filterState";
import { todayISTDateString } from "@/lib/timezone";

export const runtime = "nodejs";

type Ctx = { params: { pageKey: string } };

/** Body: { search: "<page query string>" } — the server picks what to remember. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pageKey = decodeURIComponent(params.pageKey);
  if (!hasPersistedFilterKeys(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const search = (body as { search?: unknown } | null)?.search;
  if (typeof search !== "string") {
    return NextResponse.json({ error: "Body must include search" }, { status: 400 });
  }

  const filters = pickPersistableFilters(
    pageKey,
    new URLSearchParams(search),
    todayISTDateString()
  );
  if (!filters) return NextResponse.json({ ok: true, skipped: true });

  try {
    const orgId = await requireOrgId();
    await saveTableViewFilters(session.userId, pageKey, orgId, filters);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save filters";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
