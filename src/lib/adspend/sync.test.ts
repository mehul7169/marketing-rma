import { describe, expect, it } from "vitest";
import { buildAdspendSlackText, buildDesiredRows } from "@/lib/adspend/sync";

describe("buildDesiredRows", () => {
  it("writes ₹0 for a validated account with no insights, and omits failed accounts", () => {
    const spend = new Map<string, { spend: number; currency: string | null }>([
      ["2026-11-24\tKaran", { spend: 10179, currency: "INR" }]
    ]);
    const rows = buildDesiredRows(
      ["2026-11-24"],
      [{ clientName: "Karan" }, { clientName: "Garvit" }],
      spend
    );
    expect(rows).toEqual([
      {
        dateISO: "2026-11-24",
        dateSheet: "24/11/2026",
        client: "Karan",
        spend: 10179,
        currency: "INR"
      },
      {
        dateISO: "2026-11-24",
        dateSheet: "24/11/2026",
        client: "Garvit",
        spend: 0,
        currency: null
      }
    ]);
  });
});

describe("buildAdspendSlackText", () => {
  it("flags non-INR currency and skips the daily empty-B list", () => {
    const text = buildAdspendSlackText({
      ok: true,
      error: null,
      rowsUpserted: 2,
      writeTarget: { tab: "Data", reason: "values", dataHasFormula: false },
      accounts: [
        {
          client: "Faraz",
          nonInr: true,
          currency: "USD",
          status: "ok",
          adAccountId: "1",
          act: "act_1",
          trackerName: "Faraz",
          days: [],
          error: null,
          metaName: "Faraz",
          businessAdAccounts: null
        }
      ],
      skippedNoId: [
        {
          sheetRow: 4,
          trackerName: "Directive Labs",
          clientName: "Eshaan",
          adAccountIdRaw: "",
          reason: "no ad account ID"
        }
      ],
      fromISO: "2026-11-24",
      toISO: "2026-11-24",
      dryRun: false,
      trackerSynced: 1,
      desired: [],
      updates: 0,
      inserts: 0,
      appends: 0,
      warnings: []
    });
    expect(text).toContain("currency USD (not INR)");
    expect(text).not.toContain("Eshaan");
  });
});

