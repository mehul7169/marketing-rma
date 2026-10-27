/** Plain-language + calculation copy for Insights info tips (cohort-based). */
export const INSIGHTS_TOOLTIPS = {
  formQualified:
    "Of leads created in this date range who filled the form, what share were marked qualified by the form's criteria — regardless of when qualification was recorded. Calculation: cohort members with form_qualified = true ÷ cohort members with form_filled_at set.",
  qualified:
    "Of leads contacted in this date range (first_contacted_at in range), what share the setter marked Qualified (qualified_at in range). Includes leads who later died. Calculation: Qualified ÷ Contacted.",
  showUp:
    "Of calls booked in this date range (call_booked_at in range), what share showed up (call_showed_at in range). Includes leads who later died. Calculation: Showups ÷ Calls Booked.",
  closure:
    "Of qualified showups in this date range, what share closed a deal (closed_at in range). Post-call; unchanged until the after-sales tab. Calculation: Deals Closed ÷ Qualified Showups.",
  creativeSpend:
    "Total Meta ad spend attributed to this creative for the selected date range, from Meta's own reporting (period spend — not cohort-based).",
  creativeCallsBooked:
    "Of leads created in this range whose UTM Content matches this creative, how many have call_booked_at set — regardless of when they booked.",
  creativeQualified:
    "Of leads created in this range matched to this creative, how many have qualified = true — regardless of when the setter decided.",
  creativeShowed:
    "Of leads created in this range matched to this creative, how many have call_showed = true — regardless of when.",
  creativeDealsClosed:
    "Of leads created in this range matched to this creative, how many have deal_closed = true — regardless of when.",
  creativeCostPerBooked:
    "Period spend ÷ cohort Calls Booked for this creative. Blank/dash if zero bookings.",
  creativeCostPerDeal:
    "Period spend ÷ cohort Deals Closed for this creative. Blank/dash if zero deals closed.",
  creativeUnmatched:
    "Cohort leads (created in this range) whose UTM Content didn't match a Meta ad id or ad name. Remaining unmatched are often non-Meta traffic, or ads whose tracking template still has an unsubstituted {{ad.name}} / {{ad.id}} — fix those in Ads Manager.",
  sourceBooked:
    "Of leads created in this range who have call_booked_at set, grouped by lead source (e.g. Meta, YouTube) as recorded when the lead filled the form — regardless of when they booked.",
  setterActivity:
    "Work Queue call logs (lead_activities, type call_attempt), bucketed by the IST day the call was logged and by who logged it. Event-based, not cohort-based. Total Dials counts every logged call, repeats included. Calls Booked counts only bookings made on the call: a Qualified outcome where that call set the lead's booking (call_booked_at within 5 minutes), once per lead. Qualify calls on leads who had already booked on cal.com are not counted. No Answer, Unqualified and Follow-up count call outcomes only.",
  dailyTrend:
    "Each line counts leads by the date the relevant event happened (booking date, show date, or close date respectively), in IST. Not cumulative — each day shows that day's count only. Unlike the tables above, this stays event-based."
} as const;
