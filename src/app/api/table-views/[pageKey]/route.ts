import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  deleteTableViewForUser,
  getTableViewForUser,
  upsertTableViewForUser
} from "@/lib/db/table_views";
import { isTableViewPageKey } from "@/lib/table-views/registry";
import { parseTableViewConfig } from "@/lib/table-views/types";

export const runtime = "nodejs";

type Ctx = { params: { pageKey: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }

  try {
    const row = await getTableViewForUser(session.userId, pageKey);
    return NextResponse.json(row ? row.config : null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load view";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = parseTableViewConfig(body);
  if (!config || config.columns.length === 0) {
    return NextResponse.json(
      { error: "Body must include columns: [{ id, visible, width? }]" },
      { status: 400 }
    );
  }

  try {
    const row = await upsertTableViewForUser(session.userId, pageKey, config);
    return NextResponse.json(row.config);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save view";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Reset: delete saved config so clients fall back to page defaults. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }

  try {
    await deleteTableViewForUser(session.userId, pageKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset view";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
