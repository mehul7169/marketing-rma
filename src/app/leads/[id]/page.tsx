import { notFound } from "next/navigation";
import LeadActions from "@/components/leads/LeadActions";
import StageBadge, { stageLabel } from "@/components/leads/StageBadge";
import { getLeadById } from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import { formatCurrencyNullable } from "@/lib/format";
import { format } from "date-fns";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}

function lastTouch(lead: LeadRow): { by: string; at: string } {
  const events = [
    { by: lead.closed_by, at: lead.closed_at },
    { by: lead.post_call_status_updated_by, at: lead.post_call_status_updated_at },
    { by: lead.call_showed_by, at: lead.call_showed_at },
    { by: lead.setter_verified_by, at: lead.setter_verified_at },
    { by: lead.qualified_by, at: lead.qualified_at }
  ].filter((e): e is { by: string; at: string } => Boolean(e.by && e.at));

  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  if (events[0]) return events[0];
  return { by: "—", at: lead.updated_at };
}

export default async function LeadDetailPage({
  params
}: {
  params: { id: string };
}) {
  const lead = await getLeadById(params.id);
  if (!lead) notFound();

  const touch = lastTouch(lead);

  return (
    <div className="space-y-6">
      <div>
        <a href="/leads" className="text-sm text-slate-600 hover:text-slate-900">
          ← Leads
        </a>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">
            {lead.name || lead.email}
          </h1>
          <StageBadge stage={lead.stage} />
          <span className="text-xs text-slate-500">
            {lead.lifecycle_status
              ? lead.lifecycle_status.charAt(0).toUpperCase() + lead.lifecycle_status.slice(1)
              : "Active"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Last updated {fmtWhen(lead.updated_at)}
          {touch.by !== "—" ? ` · last action by ${touch.by} at ${fmtWhen(touch.at)}` : ""}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">Record</h2>
          <div className="grid grid-cols-2 gap-4 rounded border border-slate-200 p-4">
            <Field label="Email" value={lead.email} />
            <Field label="Phone" value={lead.phone} />
            <Field label="Source" value={lead.lead_source} />
            <Field label="Ad set ID" value={lead.ad_set_id} />
            <Field label="UTM source" value={lead.utm_source} />
            <Field label="UTM medium" value={lead.utm_medium} />
            <Field label="UTM campaign" value={lead.utm_campaign} />
            <Field label="UTM content" value={lead.utm_content} />
            <Field label="UTM term" value={lead.utm_term} />
            <Field label="Created" value={fmtWhen(lead.created_at)} />
            <Field label="Form filled" value={fmtWhen(lead.form_filled_at)} />
            <Field label="Call booked" value={fmtWhen(lead.call_booked_at)} />
            <Field label="Call scheduled" value={fmtWhen(lead.call_scheduled_for)} />
            <Field label="Cal.com booking" value={lead.cal_com_booking_id} />
            <Field label="Cancelled" value={fmtWhen(lead.call_cancelled_at)} />
            <Field label="Deal value" value={formatCurrencyNullable(lead.deal_value)} />
            <Field label="GHL contact" value={lead.ghl_contact_id} />
            <Field label="Lifecycle" value={lead.lifecycle_status} />
            <Field label="Post-call status" value={lead.post_call_status ? stageLabel(lead.post_call_status) : null} />
            <Field
              label="Post-call updated"
              value={
                lead.post_call_status_updated_by
                  ? `${lead.post_call_status_updated_by}${lead.post_call_status_updated_at ? ` · ${fmtWhen(lead.post_call_status_updated_at)}` : ""}`
                  : fmtWhen(lead.post_call_status_updated_at)
              }
            />
            <Field
              label="Requalification"
              value={
                lead.requalification_attempted
                  ? `${lead.requalification_result || "in progress"}${lead.requalification_called_at ? ` · ${fmtWhen(lead.requalification_called_at)}` : ""}`
                  : "Not attempted"
              }
            />
          </div>

          <h2 className="text-sm font-medium text-slate-900">Qualification form</h2>
          <div className="grid grid-cols-2 gap-4 rounded border border-slate-200 p-4">
            <Field label="Describes you" value={lead.describes_you} />
            <Field label="Biggest goal" value={lead.biggest_goal} />
            <Field label="Monthly revenue" value={lead.monthly_revenue} />
            <Field label="Investment capacity" value={lead.investment_capacity} />
            <Field
              label="Qualified by"
              value={
                lead.qualified_by
                  ? `${lead.qualified_by}${lead.qualified_at ? ` · ${fmtWhen(lead.qualified_at)}` : ""}`
                  : null
              }
            />
          </div>
          {lead.form_answers ? (
            <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              {JSON.stringify(lead.form_answers, null, 2)}
            </pre>
          ) : null}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">Actions</h2>
          <div className="rounded border border-slate-200 p-4">
            <LeadActions lead={lead} />
          </div>
        </section>
      </div>
    </div>
  );
}
