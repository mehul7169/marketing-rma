/**
 * 9:00 AM IST deal follow-up digest. Buckets come from classifyOpenDeal /
 * computeDealMetrics (same as the Deals tab tiles). No new date logic.
 *
 * RMA-only today (same as daily-summary). To add orgs, resolve each org's
 * webhook (env map or a column) and loop gather + post per org.
 */

import { listLeads } from "@/lib/db/leads";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import {
  actorDisplayName,
  computeDealMetrics,
  formatDealDueAt,
  groupOpenDeals,
  type DealMetrics
} from "@/lib/deals/dealGroups";
import { listFiltersForDeals, parseDealSearchParams } from "@/lib/deals/dealListParams";
import { slackDealUrl } from "@/lib/leads/leadHref";
import type { LeadRow } from "@/lib/leads/types";
import { formatCalendarDate, formatIST, toISTDateString } from "@/lib/timezone";

export const DEALS_DIGEST_LINE_CAP = 40;
const APP_DEALS_URL = "https://tracking.runmoreads.in/deals";

export function dealsDigestWebhookUrl(): string | null {
  const dedicated = process.env.SLACK_DEALS_DIGEST_WEBHOOK_URL?.trim();
  if (dedicated) return dedicated;
  const fallback = process.env.SLACK_DAILY_SUMMARY_WEBHOOK_URL?.trim();
  return fallback || null;
}

export type DigestDealLine = {
  leadId: string;
  name: string;
  nextStep: string;
  dueLabel: string;
  overdue: boolean;
};

export type DigestOwnerGroup = {
  ownerId: string | null;
  ownerLabel: string;
  lines: DigestDealLine[];
};

export type DealsDigestData = {
  dateISO: string;
  asOf: Date;
  metrics: Pick<DealMetrics, "overdue" | "dueToday" | "needsNextStep">;
  owners: DigestOwnerGroup[];
  truncated: number;
};

type Block = Record<string, unknown>;

function mrkdwn(text: string): Block {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function slackEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function dueParen(lead: LeadRow, overdue: boolean, now: Date): string {
  if (!overdue) {
    return `(${formatIST(lead.next_action_at!, "h:mm a")})`;
  }
  const label = formatDealDueAt(lead.next_action_at, now);
  const pretty = label.charAt(0).toLowerCase() + label.slice(1);
  return `(${pretty})`;
}

function leadName(lead: LeadRow): string {
  return (lead.name?.trim() || lead.email || "Lead").replace(/\s+/g, " ");
}

export function openDealsListFilters(orgId: string) {
  return listFiltersForDeals({
    orgId,
    view: parseDealSearchParams({}),
    actorUserId: null
  });
}

async function emailsByProfileId(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0 || !supabaseAdmin) return {};
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .in("id", unique);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; email: string | null };
    if (r.email) out[r.id] = r.email;
  }
  return out;
}

export function digestFromOpenDeals(
  rows: LeadRow[],
  emails: Record<string, string>,
  asOf: Date = new Date()
): DealsDigestData {
  const metrics = computeDealMetrics(rows, [], asOf);
  const groups = groupOpenDeals(rows, asOf);
  const overdue = groups.find((g) => g.id === "overdue")?.rows ?? [];
  const today = groups.find((g) => g.id === "today")?.rows ?? [];
  const listed = [
    ...overdue.map((lead) => ({ lead, overdue: true as const })),
    ...today.map((lead) => ({ lead, overdue: false as const }))
  ];

  const byOwner = new Map<string, DigestOwnerGroup>();
  function bucket(ownerId: string | null): DigestOwnerGroup {
    const key = ownerId ?? "unassigned";
    let g = byOwner.get(key);
    if (!g) {
      g = {
        ownerId,
        ownerLabel: ownerId
          ? actorDisplayName(emails[ownerId] ?? null)
          : "Unassigned",
        lines: []
      };
      if (g.ownerLabel === "—") g.ownerLabel = "Unknown";
      byOwner.set(key, g);
    }
    return g;
  }

  for (const { lead, overdue: isOverdue } of listed) {
    bucket(lead.owner_id).lines.push({
      leadId: lead.id,
      name: leadName(lead),
      nextStep: (lead.next_step ?? "").trim() || "Follow up",
      dueLabel: dueParen(lead, isOverdue, asOf),
      overdue: isOverdue
    });
  }

  const owners = Array.from(byOwner.values()).sort((a, b) => {
    if (a.ownerId === null) return 1;
    if (b.ownerId === null) return -1;
    return a.ownerLabel.localeCompare(b.ownerLabel);
  });

  let used = 0;
  let truncated = 0;
  const capped: DigestOwnerGroup[] = [];
  for (const owner of owners) {
    if (used >= DEALS_DIGEST_LINE_CAP) {
      truncated += owner.lines.length;
      continue;
    }
    const keep = DEALS_DIGEST_LINE_CAP - used;
    if (owner.lines.length <= keep) {
      capped.push(owner);
      used += owner.lines.length;
    } else {
      capped.push({ ...owner, lines: owner.lines.slice(0, keep) });
      truncated += owner.lines.length - keep;
      used = DEALS_DIGEST_LINE_CAP;
    }
  }

  return {
    dateISO: toISTDateString(asOf),
    asOf,
    metrics: {
      overdue: metrics.overdue,
      dueToday: metrics.dueToday,
      needsNextStep: metrics.needsNextStep
    },
    owners: capped,
    truncated
  };
}

export async function gatherDealsDigest(
  orgId: string,
  asOf: Date = new Date()
): Promise<DealsDigestData> {
  const rows = await listLeads(openDealsListFilters(orgId));
  const ownerIds = rows
    .map((lead) => lead.owner_id)
    .filter((id): id is string => Boolean(id));
  const emails = await emailsByProfileId(ownerIds);
  return digestFromOpenDeals(rows, emails, asOf);
}

function formatLine(line: DigestDealLine): string {
  const bullet = line.overdue ? "🔴" : "•";
  const href = slackDealUrl(line.leadId);
  return `${bullet} <${href}|${slackEscape(line.name)}> — ${slackEscape(line.nextStep)} ${line.dueLabel}`;
}

export function buildDealsDigestMessage(d: DealsDigestData): {
  text: string;
  blocks: Block[];
} {
  const dayLabel = formatCalendarDate(d.dateISO, "EEE d MMM");
  const title = `Deal follow-ups — ${dayLabel}`;
  const { overdue, dueToday, needsNextStep } = d.metrics;

  if (overdue === 0 && dueToday === 0) {
    const text = "No deal follow-ups due today.";
    return { text, blocks: [mrkdwn(text)] };
  }

  const summary = `${overdue} overdue · ${dueToday} due today · ${needsNextStep} need a next step`;
  const blocks: Block[] = [
    { type: "header", text: { type: "plain_text", text: title, emoji: true } },
    mrkdwn(summary)
  ];

  for (const owner of d.owners) {
    if (owner.lines.length === 0) continue;
    const body = owner.lines.map(formatLine).join("\n");
    blocks.push(mrkdwn(`*${slackEscape(owner.ownerLabel)}*\n${body}`));
  }

  if (d.truncated > 0) {
    blocks.push(mrkdwn(`<${APP_DEALS_URL}|+${d.truncated} more in Deals>`));
  }

  return { text: `${title}: ${summary}`, blocks };
}
