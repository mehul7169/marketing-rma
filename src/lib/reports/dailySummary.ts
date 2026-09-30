import { formatCurrency, formatInteger } from "@/lib/format";
import type {
  SetterActivityCounts,
  SetterActivityReport
} from "@/lib/insights/setterActivity";
import { formatCalendarDate, formatIST } from "@/lib/timezone";

const APP_BASE_URL = "https://tracking.runmoreads.in";

export type DailySummaryData = {
  /** IST calendar day, YYYY-MM-DD. */
  dateISO: string;
  /** When the numbers were gathered (UTC instant). */
  asOf: Date;
  setter: SetterActivityReport;
  adSpend: number;
  leadsReceived: number;
  /** Leads whose call_booked_at is today (any booking path). */
  callsBooked: number;
  /** Latest meta-ads cron run — spend is only as fresh as this. */
  metaLastRun: { ranAt: string; ok: boolean } | null;
};

type Block = Record<string, unknown>;

function mrkdwn(text: string): Block {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function context(text: string): Block {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

/** Setters are identified by email; show the local part as the name. */
export function setterName(label: string): string {
  const local = label.split("@")[0] ?? label;
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : label;
}

function countsLine(c: SetterActivityCounts): string {
  return [
    `${formatInteger(c.dials)} dials`,
    `${formatInteger(c.callsBooked)} booked`,
    `${formatInteger(c.noAnswer)} no answer`,
    `${formatInteger(c.unqualified)} unqualified`,
    `${formatInteger(c.followUp)} follow-up`
  ].join(" · ");
}

export function buildDailySummaryMessage(d: DailySummaryData): {
  text: string;
  blocks: Block[];
} {
  const asOfTime = formatIST(d.asOf, "h:mm a");
  const dayLabel = formatCalendarDate(d.dateISO, "EEE d MMM yyyy");
  const title = `📊 Daily summary — ${dayLabel}`;
  const range = `from=${d.dateISO}&to=${d.dateISO}`;

  const setterLines =
    d.setter.users.length === 0
      ? ["_No calls logged yet today._"]
      : d.setter.users.map((u) => `*${setterName(u.label)}*\n${countsLine(u)}`);
  if (d.setter.users.length > 1) {
    setterLines.push(`*Team total*\n${countsLine(d.setter.orgTotals)}`);
  }

  const marketing = [
    "*📣 Marketing*",
    `💸 Ad spend: *${formatCurrency(d.adSpend)}*`,
    `🧲 Leads received: *${formatInteger(d.leadsReceived)}*`,
    `📅 Calls booked: *${formatInteger(d.callsBooked)}*`
  ].join("\n");

  const notes: string[] = [];
  if (d.metaLastRun) {
    const at = formatIST(d.metaLastRun.ranAt, "h:mm a");
    notes.push(
      d.metaLastRun.ok
        ? `Ad spend as of the Meta sync at ${at} IST.`
        : `⚠️ The Meta sync at ${at} IST failed — ad spend may be stale.`
    );
  }
  const setterBooked = d.setter.orgTotals.callsBooked;
  if (setterBooked !== d.callsBooked) {
    notes.push(
      `ℹ️ Calls booked differ: ${d.callsBooked} leads booked today vs ${setterBooked} booked on a logged setter call ` +
        "(the rest were self-booked on cal.com or booked outside a logged call)."
    );
  }

  const blocks: Block[] = [
    { type: "header", text: { type: "plain_text", text: title, emoji: true } },
    context(`⏱️ *Today so far, as of ${asOfTime} IST* — not a final end-of-day count.`),
    { type: "divider" },
    mrkdwn(`*📞 Setter Activity*\n\n${setterLines.join("\n\n")}`),
    { type: "divider" },
    mrkdwn(marketing),
    ...(notes.length ? [context(notes.join("\n"))] : []),
    context(
      `<${APP_BASE_URL}/insights?${range}|Insights> · <${APP_BASE_URL}/leads?lifecycle=all&${range}|Leads> · ` +
        `<${APP_BASE_URL}/leads?event=call_booked&${range}|Calls booked>`
    )
  ];

  const text = `${title} (as of ${asOfTime} IST): ${formatInteger(d.setter.orgTotals.dials)} dials, ${formatInteger(d.leadsReceived)} leads, ${formatInteger(d.callsBooked)} calls booked, ${formatCurrency(d.adSpend)} spend`;
  return { text, blocks };
}
