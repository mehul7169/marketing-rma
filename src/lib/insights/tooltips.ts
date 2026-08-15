/** Plain-language + calculation copy for Insights info tips. */
export const INSIGHTS_TOOLTIPS = {
  formQualified:
    "Percentage of leads who filled the form and were marked qualified by the form's built-in criteria. Calculation: qualified leads ÷ leads who filled the form, for the selected date range.",
  setterVerified:
    "Percentage of booked calls that Vriddhi confirmed are genuinely qualified after speaking with the lead. Calculation: setter-verified leads ÷ leads with a call booked, for the selected date range.",
  showUp:
    "Percentage of setter-verified (qualified) calls where the lead actually showed up. Calculation: verified leads who showed ÷ all setter-verified leads, for the selected date range. Only counts verified leads — not every booked call.",
  closure:
    "Percentage of qualified calls that showed up and turned into a closed deal. Calculation: closed deals ÷ setter-verified leads who showed up, for the selected date range.",
  creativeSpend:
    "Total Meta ad spend attributed to this creative for the selected date range, from Meta's own reporting.",
  creativeCallsBooked:
    "Count of leads whose UTM Content matches this creative's ad name and who booked a call in the selected date range.",
  creativeQualified:
    "Of the calls booked for this creative, how many were setter-verified as genuinely qualified.",
  creativeShowed:
    "Of the setter-verified calls for this creative, how many actually showed up.",
  creativeDealsClosed:
    "Of the leads for this creative, how many resulted in a closed deal.",
  creativeCostPerBooked:
    "Spend ÷ Calls Booked for this creative, in the selected date range.",
  creativeCostPerDeal:
    "Spend ÷ Deals Closed for this creative, in the selected date range. Blank/dash if zero deals closed (don't show a divide-by-zero artifact).",
  creativeUnmatched:
    "Leads whose UTM Content didn't match any known ad creative name from Meta. If this number is high, UTM Content values may not be matching your actual ad names — worth checking.",
  sourceBooked:
    "Count of leads with a call booked in the selected date range, grouped by lead source (e.g. Meta, YouTube) as recorded at the time the lead filled the form.",
  dailyTrend:
    "Each line counts leads by the date the relevant event happened (booking date, show date, or close date respectively), in IST. Not cumulative — each day shows that day's count only."
} as const;
