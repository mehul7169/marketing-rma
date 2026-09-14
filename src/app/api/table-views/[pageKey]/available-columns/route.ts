import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { requireOrgId } from "@/lib/auth/getCurrentOrgId";
import {
  isTableViewPageKey
} from "@/lib/table-views/registry";
import { listAvailableColumnsForPage } from "@/lib/table-views/loadBootstrap";

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
    const orgId = await requireOrgId();
    const columns = await listAvailableColumnsForPage(pageKey, { orgId });
    return NextResponse.json({ columns });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list columns";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
