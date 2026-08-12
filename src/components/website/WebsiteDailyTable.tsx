import type { WebsiteDailyTableRow } from "@/lib/db/website_daily";

function fmtMaybePct(v: number | null) {
  if (v === null) return "—";
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export default function WebsiteDailyTable({ rows }: { rows: WebsiteDailyTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Landing Page Visits</th>
            <th className="px-4 py-3 text-right">Unique Visitors</th>
            <th className="px-4 py-3 text-right">Video Plays</th>
            <th className="px-4 py-3 text-right">Avg Watch %</th>
            <th className="px-4 py-3 text-right">Completion Rate</th>
            <th className="px-4 py-3 text-right">Form Starts</th>
            <th className="px-4 py-3 text-right">Form Completions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                No data in this date range.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.date} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 text-left font-medium text-slate-900">
                  {r.date}
                </td>
                <td className="px-4 py-3 text-right">{r.landing_page_visits.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{r.unique_visitors.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{r.video_plays.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{fmtMaybePct(r.video_avg_watch_percent)}</td>
                <td className="px-4 py-3 text-right">{fmtMaybePct(r.video_completion_rate)}</td>
                <td className="px-4 py-3 text-right">{r.form_starts.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{r.form_completions.toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

