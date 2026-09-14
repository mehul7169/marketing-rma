import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { notFound } from "next/navigation";
import CopyValue from "@/components/CopyValue";
import ActionStatusBadge from "@/components/leads/ActionStatusBadge";
import CustomFieldsPanel from "@/components/leads/CustomFieldsPanel";
import LeadActions from "@/components/leads/LeadActions";
import LeadFollowUps from "@/components/leads/LeadFollowUps";
import ReviveLeadButton from "@/components/leads/ReviveLeadButton";
import WhatsAppNudgeButton from "@/components/leads/WhatsAppNudgeButton";
import StageBadge, { stageLabel } from "@/components/leads/StageBadge";
import { listLeadActivities } from "@/lib/db/lead_activities";
import { listRemindersForLead } from "@/lib/db/lead_reminders";
import { getLeadById } from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import { formatCurrencyNullable } from "@/lib/format";
import { formatDueFriendly, formatISTDateTime } from "@/lib/timezone";

function fmtWhen(iso: string | null): string {
  return formatISTDateTime(iso);
}

function Field({
  label,
  value,
  copyable
}: {
  label: string;
  value: string | null | undefined;
  copyable?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-900">
        <span>{value || "—"}</span>
        {copyable ? <CopyValue value={value} /> : null}
      </div>
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
  const orgId = await getCurrentOrgId();
  const lead = await getLeadById(params.id, orgId);
  if (!lead) notFound();

  const [reminders, activities] = await Promise.all([
    listRemindersForLead(lead.id, orgId),
    listLeadActivities(lead.id, orgId, { limit: 50 })
  ]);
  const touch = lastTouch(lead);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          <a href="/leads" className="hover:text-slate-900">
            ← Leads
          </a>
          <a href="/leads/queue" className="hover:text-slate-900">
            Work Queue
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{lead.name || lead.email}</h1>
          <ActionStatusBadge actionStatus={lead.action_status} />
          <StageBadge stage={lead.stage} />
          {lead.is_dead ? <ReviveLeadButton leadId={lead.id} /> : null}
          {lead.contact_attempts === 1 || lead.contact_attempts === 3 ? (
            <WhatsAppNudgeButton leadId={lead.id} />
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Last updated {fmtWhen(lead.updated_at)}
          {touch.by !== "—"
            ? ` · last action by ${touch.by} at ${fmtWhen(touch.at)}`
            : ""}
          {lead.dead_reason ? ` · Dead: ${lead.dead_reason}` : ""}
        </p>
      </div>

      <section className="space-y-3 rounded border border-slate-200 p-4">
        <h2 className="text-sm font-medium text-slate-900">Lifecycle</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Status"
            value={lead.action_status ?? "Untouched"}
          />
          <Field
            label="Next Action"
            value={
              lead.next_action_at
                ? formatDueFriendly(lead.next_action_at)
                : null
            }
          />
          <Field label="Last Action" value={lead.last_action} />
          <Field
            label="Last Action At"
            value={fmtWhen(lead.last_action_at)}
          />
          <Field
            label="Follow-up Date"
            value={
              lead.next_action_at ? fmtWhen(lead.next_action_at) : null
            }
          />
          <Field label="Attempts" value={String(lead.contact_attempts ?? 0)} />
          <Field
            label="Call confirmed"
            value={
              lead.call_confirmed === true
                ? "Yes"
                : lead.call_confirmed === false
                  ? "No"
                  : null
            }
          />
          <Field
            label="Last note / conversation"
            value={
              activities.find((a) => a.note)?.note ??
              lead.notes ??
              null
            }
          />
        </div>

        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            Recent Activity ({activities.length})
          </summary>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm text-slate-700">
            {activities.length === 0 ? (
              <li className="text-slate-500">No activities yet.</li>
            ) : (
              activities.map((a) => (
                <li
                  key={a.id}
                  className="rounded border border-slate-100 px-3 py-2"
                >
                  <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{a.type}</span>
                    {a.outcome ? <span>{a.outcome}</span> : null}
                    <span>{fmtWhen(a.created_at)}</span>
                    {a.created_by ? <span>by {a.created_by}</span> : null}
                  </div>
                  {a.note ? <p className="mt-1 text-sm">{a.note}</p> : null}
                </li>
              ))
            )}
          </ul>
        </details>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">Actions</h2>
          <div className="rounded border border-slate-200 p-4">
            <LeadActions key={lead.updated_at} lead={lead} />
          </div>
          <h2 className="text-sm font-medium text-slate-900">Follow-ups</h2>
          <div className="rounded border border-slate-200 p-4">
            <LeadFollowUps
              key={`${lead.id}-followups-${reminders.length}`}
              leadId={lead.id}
              reminders={reminders}
            />
          </div>
        </section>

        <section className="space-y-4">
          <details className="rounded border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-900">
              Campaign & technical details
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Email" value={lead.email} copyable />
              <Field label="Phone" value={lead.phone} copyable />
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
              <Field
                label="Call scheduled"
                value={fmtWhen(lead.call_scheduled_for)}
              />
              <Field
                label="Booking source"
                value={
                  lead.booking_source === "manual"
                    ? "Manual"
                    : lead.booking_source === "cal_com"
                      ? "Cal.com"
                      : null
                }
              />
              <Field label="Cal.com booking" value={lead.cal_com_booking_id} />
              <Field label="Cancelled" value={fmtWhen(lead.call_cancelled_at)} />
              <Field
                label="Deal value"
                value={formatCurrencyNullable(lead.deal_value)}
              />
              <div>
                <div className="text-xs text-slate-500">Recording link</div>
                <div className="mt-0.5 text-sm text-slate-900">
                  {lead.recording_url ? (
                    <a
                      href={
                        /^https?:\/\//i.test(lead.recording_url)
                          ? lead.recording_url
                          : `https://${lead.recording_url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                    >
                      {lead.recording_url}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <Field label="GHL contact" value={lead.ghl_contact_id} />
              <Field label="Lifecycle" value={lead.lifecycle_status} />
              <Field
                label="Post-call status"
                value={
                  lead.post_call_status
                    ? stageLabel(lead.post_call_status)
                    : null
                }
              />
              <Field
                label="Post-call updated"
                value={
                  lead.post_call_status_updated_by
                    ? `${lead.post_call_status_updated_by}${
                        lead.post_call_status_updated_at
                          ? ` · ${fmtWhen(lead.post_call_status_updated_at)}`
                          : ""
                      }`
                    : fmtWhen(lead.post_call_status_updated_at)
                }
              />
              <Field
                label="Requalification"
                value={
                  lead.requalification_attempted
                    ? `${lead.requalification_result || "in progress"}${
                        lead.requalification_called_at
                          ? ` · ${fmtWhen(lead.requalification_called_at)}`
                          : ""
                      }`
                    : "Not attempted"
                }
              />
            </div>
          </details>

          <details className="rounded border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-900">
              Form Details
            </summary>
            <div className="mt-4 space-y-4">
              <CustomFieldsPanel customFields={lead.custom_fields} />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Qualified by"
                  value={
                    lead.qualified_by
                      ? `${lead.qualified_by}${
                          lead.qualified_at
                            ? ` · ${fmtWhen(lead.qualified_at)}`
                            : ""
                        }`
                      : null
                  }
                />
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
