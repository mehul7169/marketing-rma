/** Plain-language + calculation copy for Insights info tips (cohort-based). */
export const INSIGHTS_TOOLTIPS = {
  formQualified:
    "Of leads created in this date range who filled the form, what share were marked qualified by the form's criteria — regardless of when qualification was recorded. Calculation: cohort members with qualified = true ÷ cohort members with form_filled_at set.",
  setterVerified:
    "Of leads created in this date range who booked a call, what share Vriddhi confirmed as genuinely qualified — regardless of when verification happened. Calculation: cohort members with setter_verified = true ÷ cohort members with call_booked_at set.",
  showUp:
    "Of setter-verified cohort members, what share showed up — regardless of when the show was logged. Calculation: verified + showed ÷ setter-verified, among leads created in the selected range.",
  closure:
    "Of setter-verified cohort members who showed, what share closed a deal — regardless of when. Calculation: deal_closed ÷ (setter_verified and call_showed), among leads created in the selected range.",
  creativeSpend:
    "Total Meta ad spend attributed to this creative for the selected date range, from Meta's own reporting (period spend — not cohort-based).",
  creativeCallsBooked:
    "Of leads created in this range whose UTM Content matches this creative, how many have call_booked_at set — regardless of when they booked.",
  creativeQualified:
    "Of leads created in this range matched to this creative, how many are setter-verified — regardless of when verification happened.",
  creativeShowed:
    "Of leads created in this range matched to this creative, how many have call_showed = true — regardless of when.",
  creativeDealsClosed:
    "Of leads created in this range matched to this creative, how many have deal_closed = true — regardless of when.",
  creativeCostPerBooked:
    "Period spend ÷ cohort Calls Booked for this creative. Blank/dash if zero bookings.",
  creativeCostPerDeal:
    "Period spend ÷ cohort Deals Closed for this creative. Blank/dash if zero deals closed.",
  creativeUnmatched:
    "Cohort leads (created in this range) whose UTM Content didn't match any known ad creative name from Meta. If this number is high, UTM Content values may not be matching your actual ad names — worth checking.",
  sourceBooked:
    "Of leads created in this range who have call_booked_at set, grouped by lead source (e.g. Meta, YouTube) as recorded when the lead filled the form — regardless of when they booked.",
  dailyTrend:
    "Each line counts leads by the date the relevant event happened (booking date, show date, or close date respectively), in IST. Not cumulative — each day shows that day's count only. Unlike the tables above, this stays event-based."
} as const;
