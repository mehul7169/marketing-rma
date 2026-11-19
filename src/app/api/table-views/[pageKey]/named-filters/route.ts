import { NextRequest, NextResponse } from "next/server";
import { requireOrgId } from "@/lib/auth/getCurrentOrgId";
import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { getCurrentSession } from "@/lib/auth/session";
import {
  deleteNamedFilter,
  findNamedFilterOwner,
  listNamedFiltersForUser,
  saveNamedFilter
} from "@/lib/db/namedFilters";
import { getMembershipRole } from "@/lib/db/memberships";
import { isTableViewPageKey } from "@/lib/table-views/registry";

export const runtime = "nodejs";

type Ctx = { params: { pageKey: string } };

async function actor() {
  const session = await getCurrentSession();
  if (!session) return null;
  const orgId = await requireOrgId();
  const [role, platform] = await Promise.all([
    getMembershipRole(session.userId, orgId),
    isPlatformAdmin()
  ]);
  return {
    userId: session.userId,
    orgId,
    canManageShared: role === "admin" || platform
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }
  const a = await actor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listNamedFiltersForUser({
    userId: a.userId,
    pageKey,
    orgId: a.orgId
  });
  return NextResponse.json({ items, canManageShared: a.canManageShared });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }
  const a = await actor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof (body as { name?: unknown }).name === "string" ? (body as { name: string }).name : "";
  const query = (body as { query?: unknown }).query;
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const paramsMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
    if (typeof v === "string") paramsMap[k] = v;
  }
  const shared = (body as { shared?: unknown }).shared === true;
  if (shared && !a.canManageShared) {
    return NextResponse.json({ error: "Only admins can share filters" }, { status: 403 });
  }
  const item = await saveNamedFilter({
    userId: a.userId,
    pageKey,
    orgId: a.orgId,
    name,
    shared,
    query: paramsMap
  });
  return NextResponse.json({ item });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }
  const a = await actor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const owned = await findNamedFilterOwner({ pageKey, orgId: a.orgId, id });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = owned.userId === a.userId;
  if (owned.filter.shared && !a.canManageShared) {
    return NextResponse.json({ error: "Only admins can edit shared filters" }, { status: 403 });
  }
  if (!owned.filter.shared && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const name =
    typeof (body as { name?: unknown }).name === "string"
      ? (body as { name: string }).name
      : owned.filter.name;
  const shared =
    typeof (body as { shared?: unknown }).shared === "boolean"
      ? (body as { shared: boolean }).shared
      : owned.filter.shared;
  if (shared && !a.canManageShared) {
    return NextResponse.json({ error: "Only admins can share filters" }, { status: 403 });
  }
  const queryRaw = (body as { query?: unknown }).query;
  let query = owned.filter.query;
  if (queryRaw && typeof queryRaw === "object" && !Array.isArray(queryRaw)) {
    query = {};
    for (const [k, v] of Object.entries(queryRaw as Record<string, unknown>)) {
      if (typeof v === "string") query[k] = v;
    }
  }
  const item = await saveNamedFilter({
    userId: owned.userId,
    pageKey,
    orgId: a.orgId,
    id,
    name,
    shared,
    query
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const pageKey = decodeURIComponent(params.pageKey);
  if (!isTableViewPageKey(pageKey)) {
    return NextResponse.json({ error: "Unknown page key" }, { status: 400 });
  }
  const a = await actor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const owned = await findNamedFilterOwner({ pageKey, orgId: a.orgId, id });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (owned.filter.shared && !a.canManageShared) {
    return NextResponse.json({ error: "Only admins can delete shared filters" }, { status: 403 });
  }
  if (!owned.filter.shared && owned.userId !== a.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await deleteNamedFilter({
    userId: owned.userId,
    pageKey,
    orgId: a.orgId,
    id
  });
  return NextResponse.json({ ok: true });
}
