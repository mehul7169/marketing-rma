import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { addClientAccount } from "@/lib/clients/addClientAccount";
import {
  isValidNumericAdAccountIdInput,
  toActPrefixedAdAccountId
} from "@/lib/clients/metaAdAccountId";
import {
  createOrganization,
  getOrganizationById
} from "@/lib/db/organizations";
import { formatOrgSlug } from "@/lib/orgs/formatOrgSlug";

export const runtime = "nodejs";
/** Allow long-running background backfill when the platform keeps the isolate alive. */
export const maxDuration = 300;

function scheduleBackground(task: Promise<unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { waitUntil } = require("@vercel/functions") as {
      waitUntil?: (p: Promise<unknown>) => void;
    };
    if (typeof waitUntil === "function") {
      waitUntil(task);
      return;
    }
  } catch {
    // Local / non-Vercel: keep the promise on the event loop.
  }
  void task;
}

type Body = {
  metaAdAccountId?: unknown;
  /** Existing organizations.id */
  orgId?: unknown;
  /** Create org first, then attach the account (name → slug via formatOrgSlug). */
  newOrganizationName?: unknown;
};

async function resolveOrgId(body: Body): Promise<string> {
  const orgId =
    typeof body.orgId === "string" ? body.orgId.trim() : "";
  const newName =
    typeof body.newOrganizationName === "string"
      ? body.newOrganizationName.trim()
      : "";

  if (orgId && newName) {
    throw new Error("Provide either an existing org or a new organization name, not both");
  }

  if (orgId) {
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organization not found");
    return org.id;
  }

  if (newName) {
    const slug = formatOrgSlug(newName);
    if (!slug) throw new Error("Organization name must produce a valid slug");
    const org = await createOrganization({ name: newName, slug });
    return org.id;
  }

  throw new Error("Select an organization or create a new one");
}

export async function POST(req: NextRequest) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawId =
    typeof body.metaAdAccountId === "string" ? body.metaAdAccountId : "";

  if (!isValidNumericAdAccountIdInput(rawId)) {
    return NextResponse.json(
      { error: "Enter just the numeric ID, without act_" },
      { status: 400 }
    );
  }

  const metaAdAccountId = toActPrefixedAdAccountId(rawId);

  try {
    const orgId = await resolveOrgId(body);
    const result = await addClientAccount(metaAdAccountId, {
      orgId,
      waitForBackfill: false,
      scheduleBackground,
      log: (msg) => console.log(`[clients-ads add] ${msg}`)
    });

    if (result.status === "skipped") {
      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: result.reason,
        account: {
          id: result.account.id,
          client_name: result.clientName,
          meta_ad_account_id: result.account.meta_ad_account_id,
          org_id: result.account.org_id
        },
        backfillPending: false
      });
    }

    return NextResponse.json({
      ok: true,
      status: "created",
      account: {
        id: result.account.id,
        client_name: result.clientName,
        meta_ad_account_id: result.account.meta_ad_account_id,
        org_id: result.account.org_id
      },
      backfillPending: result.backfillPending
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
