import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadRow } from "@/lib/leads/types";
import {
  buildDealsDigestMessage,
  dealsDigestWebhookUrl,
  DEALS_DIGEST_LINE_CAP,
  digestFromOpenDeals
} from "@/lib/deals/dealsDigest";

const NOW = new Date("2026-11-20T04:30:00.000Z"); // Fri 20 Nov 10:00 AM IST

function lead(patch: Partial<LeadRow> & { id: string }): LeadRow {
  return {
    name: patch.name ?? "Lead",
    email: patch.email ?? `${patch.id}@manual.invalid`,
    owner_id: patch.owner_id === undefined ? "owner-a" : patch.owner_id,
    next_step: patch.next_step === undefined ? "Call" : patch.next_step,
    next_action_at:
      patch.next_action_at === undefined ? "2026-11-20T05:30:00.000Z" : patch.next_action_at,
    call_showed_at: patch.call_showed_at ?? "2026-11-01T10:00:00.000Z",
    ...patch
  } as LeadRow;
}

function allText(blocks: Record<string, unknown>[]): string {
  return JSON.stringify(blocks);
}

const emails = {
  "owner-a": "kunal@runmoreads.in",
  "owner-b": "neha@runmoreads.in"
};

describe("dealsDigestWebhookUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the dedicated env var, then the daily-summary fallback", () => {
    vi.stubEnv("SLACK_DEALS_DIGEST_WEBHOOK_URL", "https://hooks.example/deals");
    vi.stubEnv("SLACK_DAILY_SUMMARY_WEBHOOK_URL", "https://hooks.example/daily");
    expect(dealsDigestWebhookUrl()).toBe("https://hooks.example/deals");

    vi.stubEnv("SLACK_DEALS_DIGEST_WEBHOOK_URL", "");
    expect(dealsDigestWebhookUrl()).toBe("https://hooks.example/daily");

    vi.stubEnv("SLACK_DAILY_SUMMARY_WEBHOOK_URL", "  ");
    expect(dealsDigestWebhookUrl()).toBeNull();
  });
});

describe("digestFromOpenDeals + buildDealsDigestMessage", () => {
  it("groups overdue then today by owner, Unassigned last, and matches tile counts", () => {
    const rows = [
      lead({
        id: "d1",
        name: "Kunal Jiwani",
        owner_id: "owner-a",
        next_step: "Call to discuss pricing",
        next_action_at: "2026-11-19T10:30:00.000Z"
      }),
      lead({
        id: "d2",
        name: "Krishna Mittal",
        owner_id: "owner-a",
        next_step: "Payment reminder",
        next_action_at: "2026-11-20T05:30:00.000Z"
      }),
      lead({
        id: "d3",
        name: "Open later",
        owner_id: "owner-b",
        next_step: "Send contract",
        next_action_at: "2026-11-25T05:30:00.000Z"
      }),
      lead({
        id: "d4",
        name: "No step",
        owner_id: "owner-b",
        next_step: null,
        next_action_at: null
      }),
      lead({
        id: "d5",
        name: "Unowned overdue",
        owner_id: null,
        next_step: "Ping",
        next_action_at: "2026-11-18T10:30:00.000Z"
      })
    ];
    const digest = digestFromOpenDeals(rows, emails, NOW);
    expect(digest.metrics).toEqual({ overdue: 2, dueToday: 1, needsNextStep: 1 });
    expect(digest.owners.map((o) => o.ownerLabel)).toEqual(["Kunal", "Unassigned"]);
    expect(digest.owners[0].lines.map((l) => l.name)).toEqual(["Kunal Jiwani", "Krishna Mittal"]);
    expect(digest.owners[0].lines[0].overdue).toBe(true);
    expect(digest.owners[0].lines[1].overdue).toBe(false);

    const { text, blocks } = buildDealsDigestMessage(digest);
    const json = allText(blocks);
    expect(json).toContain("Deal follow-ups — Fri 20 Nov");
    expect(json).toContain("2 overdue · 1 due today · 1 need a next step");
    expect(json).toContain("🔴");
    expect(json).toContain("yesterday 4:00 PM");
    expect(json).toContain("(11:00 AM)");
    expect(json).toContain("https://tracking.runmoreads.in/deals?deal=d1");
    expect(json).toContain("https://tracking.runmoreads.in/deals?deal=d2");
    expect(json).not.toContain("hooks.slack.com");
    expect(text).toContain("Deal follow-ups");
  });

  it("posts a single empty line when nothing is overdue or due today", () => {
    const rows = [
      lead({
        id: "n1",
        next_step: null,
        next_action_at: null
      }),
      lead({
        id: "n2",
        next_step: "Later",
        next_action_at: "2026-11-25T05:30:00.000Z"
      })
    ];
    const digest = digestFromOpenDeals(rows, emails, NOW);
    expect(digest.metrics.overdue).toBe(0);
    expect(digest.metrics.dueToday).toBe(0);
    expect(digest.metrics.needsNextStep).toBe(1);
    const { text, blocks } = buildDealsDigestMessage(digest);
    expect(text).toBe("No deal follow-ups due today.");
    expect(blocks).toHaveLength(1);
    expect(allText(blocks)).toContain("No deal follow-ups due today.");
    expect(allText(blocks)).not.toContain("Deal follow-ups —");
  });

  it(`caps deal lines at ${DEALS_DIGEST_LINE_CAP} and links the remainder`, () => {
    const extra = 3;
    const rows = Array.from({ length: DEALS_DIGEST_LINE_CAP + extra }, (_, i) =>
      lead({
        id: `cap-${i}`,
        name: `Lead ${i}`,
        owner_id: "owner-a",
        next_step: "Call",
        next_action_at: "2026-11-20T05:30:00.000Z"
      })
    );
    const digest = digestFromOpenDeals(rows, emails, NOW);
    expect(digest.metrics.dueToday).toBe(DEALS_DIGEST_LINE_CAP + extra);
    expect(digest.owners[0].lines).toHaveLength(DEALS_DIGEST_LINE_CAP);
    expect(digest.truncated).toBe(extra);
    const json = allText(buildDealsDigestMessage(digest).blocks);
    expect(json).toContain(`+${extra} more in Deals`);
    expect(json).toContain("https://tracking.runmoreads.in/deals");
    expect(json).not.toContain(`deal=cap-${DEALS_DIGEST_LINE_CAP}`);
  });
});
