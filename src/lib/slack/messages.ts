import type { LeadRow } from "@/lib/leads/types";
import { formatISTDateTime } from "@/lib/timezone";
import { sendSlackMessage } from "@/lib/slack/notify";

const LEAD_BASE_URL = "https://tracking.runmoreads.in/leads";

function leadLink(lead: LeadRow): string {
  return `${LEAD_BASE_URL}/${lead.id}`;
}

function field(label: string, value: string | null | undefined): { type: "mrkdwn"; text: string } {
  return { type: "mrkdwn", text: `*${label}:*\n${value?.trim() || "—"}` };
}

function linkBlock(url: string): { type: "section"; text: { type: "mrkdwn"; text: string } } {
  return {
    type: "section",
    text: { type: "mrkdwn", text: `<${url}|View lead →>` }
  };
}

export async function notifySlackNewLead(lead: LeadRow) {
  const qualified =
    lead.qualified === true ? "✅ Qualified" : lead.qualified === false ? "❌ Not Qualified" : "Not yet decided";
  const header = `New Lead — ${qualified}`;
  const url = leadLink(lead);

  await sendSlackMessage(header, [
    { type: "header", text: { type: "plain_text", text: header, emoji: true } },
    {
      type: "section",
      fields: [
        field("Name", lead.name),
        field("Email", lead.email),
        field("Phone", lead.phone),
        field("Source", lead.lead_source),
        field("Describes you", lead.describes_you),
        field("Biggest goal", lead.biggest_goal)
      ]
    },
    linkBlock(url)
  ]);
}

export async function notifySlackCallBooked(lead: LeadRow) {
  const header = "📅 Call Booked";
  const url = leadLink(lead);

  await sendSlackMessage(header, [
    { type: "header", text: { type: "plain_text", text: header, emoji: true } },
    {
      type: "section",
      fields: [
        field("Name", lead.name),
        field("Email", lead.email),
        field("Phone", lead.phone),
        field("Scheduled for", formatISTDateTime(lead.call_scheduled_for))
      ]
    },
    linkBlock(url)
  ]);
}

export async function notifySlackNoBookingYet(lead: LeadRow, delayMinutes: number) {
  const header = "⚠️ Qualified Lead — No Booking Yet";
  const url = leadLink(lead);

  await sendSlackMessage(header, [
    { type: "header", text: { type: "plain_text", text: header, emoji: true } },
    {
      type: "section",
      fields: [
        field("Name", lead.name),
        field("Email", lead.email),
        field("Phone", lead.phone),
        field("Qualified at", formatISTDateTime(lead.qualified_at))
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `It's been ${delayMinutes}+ minutes since they filled the form and no call has been booked.`
      }
    },
    linkBlock(url)
  ]);
}
