import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { addClientAccount } from "@/lib/clients/addClientAccount";
import {
  isValidNumericAdAccountIdInput,
  toActPrefixedAdAccountId
} from "@/lib/clients/metaAdAccountId";
import {
  SESSION_COOKIE,
  parseSessionRole
} from "@/lib/auth/session";

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

export async function POST(req: NextRequest) {
  const role = await parseSessionRole(
    cookies().get(SESSION_COOKIE)?.value,
    process.env.ROLE_SECRET
  );
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawId =
    typeof body === "object" &&
    body !== null &&
    "metaAdAccountId" in body &&
    typeof (body as { metaAdAccountId: unknown }).metaAdAccountId === "string"
      ? (body as { metaAdAccountId: string }).metaAdAccountId
      : "";

  if (!isValidNumericAdAccountIdInput(rawId)) {
    return NextResponse.json(
      { error: "Enter just the numeric ID, without act_" },
      { status: 400 }
    );
  }

  const metaAdAccountId = toActPrefixedAdAccountId(rawId);

  try {
    const result = await addClientAccount(metaAdAccountId, {
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
          meta_ad_account_id: result.account.meta_ad_account_id
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
        meta_ad_account_id: result.account.meta_ad_account_id
      },
      backfillPending: result.backfillPending
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
