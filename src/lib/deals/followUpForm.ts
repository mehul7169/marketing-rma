import {
  DEAL_ERRORS,
  DEAL_FOLLOW_UP_OUTCOMES,
  DEAL_STAGES,
  LOST_REASONS,
  isDealStage,
  isLostReason,
  type DealFollowUpOutcome,
  type DealPayload,
  type DealStage,
  type LostReason
} from "@/lib/deals/dealLifecycle";
import {
  addIstCalendarDays,
  fromDatetimeLocalIST,
  toISTDateString
} from "@/lib/timezone";
import { fromZonedTime } from "date-fns-tz/fromZonedTime";
import { format } from "date-fns/format";
import { IST_TIMEZONE, utcToZonedTime } from "@/lib/timezone";

export const FOLLOW_UP_OUTCOME_LABELS: Record<DealFollowUpOutcome, string> = {
  spoke: "Spoke",
  no_answer: "No answer",
  sent_proposal: "Sent proposal",
  payment_link_sent: "Payment link sent",
  rescheduled_call: "Rescheduled call",
  other: "Other"
};

export const NEXT_STEP_PILLS = [
  "Call",
  "WhatsApp",
  "Send proposal",
  "Payment reminder",
  "Follow-up call"
] as const;

export type FollowUpFormMode = "follow_up" | "won" | "lost";

export type FollowUpFormState = {
  mode: FollowUpFormMode;
  outcome: DealFollowUpOutcome | null;
  note: string;
  nextStep: string;
  whenLocal: string;
  confirmPast: boolean;
  stage: DealStage | "" | "keep";
  value: string;
  closedLocal: string;
  lostReason: LostReason | null;
};

export function emptyFollowUpForm(now = new Date()): FollowUpFormState {
  return {
    mode: "follow_up",
    outcome: null,
    note: "",
    nextStep: "",
    whenLocal: "",
    confirmPast: false,
    stage: "keep",
    value: "",
    closedLocal: format(utcToZonedTime(now, IST_TIMEZONE), "yyyy-MM-dd'T'HH:mm"),
    lostReason: null
  };
}

function istAtEleven(yyyyMmDd: string): string {
  return fromZonedTime(`${yyyyMmDd}T11:00:00`, IST_TIMEZONE).toISOString();
}

function toLocal(iso: string): string {
  return format(utcToZonedTime(new Date(iso), IST_TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

export function followUpWhenQuickPicks(now: Date | string = new Date()): Array<{
  id: string;
  label: string;
  local: string;
}> {
  const today = toISTDateString(typeof now === "string" ? new Date(now) : now);
  const zoned = utcToZonedTime(typeof now === "string" ? new Date(now) : now, IST_TIMEZONE);
  const isoDay = Number(format(zoned, "i"));
  const daysToMonday = isoDay === 1 ? 7 : 8 - isoDay;
  return [
    {
      id: "tomorrow_11",
      label: "Tomorrow 11 AM",
      local: toLocal(istAtEleven(addIstCalendarDays(today, 1)))
    },
    {
      id: "in_2_days",
      label: "In 2 days",
      local: toLocal(istAtEleven(addIstCalendarDays(today, 2)))
    },
    {
      id: "next_monday",
      label: "Next Monday 11 AM",
      local: toLocal(istAtEleven(addIstCalendarDays(today, daysToMonday)))
    }
  ];
}

export type FollowUpFormResult =
  | { ok: true; action: "log_follow_up" | "mark_won" | "mark_lost"; payload: DealPayload }
  | { ok: false; error: string };

export function validateFollowUpForm(
  state: FollowUpFormState,
  now: Date | string = new Date()
): FollowUpFormResult {
  if (state.mode === "lost") {
    if (!isLostReason(state.lostReason)) {
      return { ok: false, error: DEAL_ERRORS.lostReasonRequired };
    }
    return {
      ok: true,
      action: "mark_lost",
      payload: {
        lostReason: state.lostReason,
        note: state.note.trim() || null
      }
    };
  }
  if (state.mode === "won") {
    const n = state.value.trim() === "" ? undefined : Number(state.value);
    if (n !== undefined && (!Number.isFinite(n) || n < 0)) {
      return { ok: false, error: DEAL_ERRORS.valueRequired };
    }
    let closedAt: string | undefined;
    if (state.closedLocal.trim()) {
      try {
        closedAt = fromDatetimeLocalIST(state.closedLocal);
      } catch {
        return { ok: false, error: DEAL_ERRORS.invalidWhen };
      }
    }
    return {
      ok: true,
      action: "mark_won",
      payload: { value: n, closedAt: closedAt ?? null }
    };
  }

  if (!state.outcome || !(DEAL_FOLLOW_UP_OUTCOMES as readonly string[]).includes(state.outcome)) {
    return { ok: false, error: DEAL_ERRORS.invalidOutcome };
  }
  const next_step = state.nextStep.trim();
  if (!next_step && !state.whenLocal.trim()) {
    return { ok: false, error: DEAL_ERRORS.nextStepRequired };
  }
  if (!next_step) return { ok: false, error: DEAL_ERRORS.nextStepWhat };
  if (!state.whenLocal.trim()) return { ok: false, error: DEAL_ERRORS.nextStepWhen };
  let next_action_at: string;
  try {
    next_action_at = fromDatetimeLocalIST(state.whenLocal);
  } catch {
    return { ok: false, error: DEAL_ERRORS.invalidWhen };
  }
  if (Date.parse(next_action_at) < asDate(now).getTime() && !state.confirmPast) {
    return { ok: false, error: DEAL_ERRORS.confirmPast };
  }
  const payload: DealPayload = {
    outcome: state.outcome,
    note: state.note.trim() || null,
    next_step,
    next_action_at,
    confirmPast: state.confirmPast
  };
  if (state.stage !== "keep" && state.stage !== "") {
    if (!isDealStage(state.stage)) return { ok: false, error: DEAL_ERRORS.invalidStage };
    payload.stage = state.stage;
  } else if (state.stage === "") {
    payload.stage = null;
  }
  return { ok: true, action: "log_follow_up", payload };
}

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export { DEAL_FOLLOW_UP_OUTCOMES, DEAL_STAGES, LOST_REASONS };
