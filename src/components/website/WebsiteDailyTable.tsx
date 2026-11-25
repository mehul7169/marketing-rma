import type { WebsiteDailyTableRow } from "@/lib/db/website_daily";
import { formatInteger, formatPercentNullable } from "@/lib/format";
import { formatCalendarDate } from "@/lib/timezone";

export default function WebsiteDailyTable({ rows }: { rows: WebsiteDailyTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-subtle">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-2 text-fg">
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
        <tbody className="divide-y divide-subtle">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted">
                No data in this date range.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.date} className="hover:bg-surface-2/60">
                <td className="px-4 py-3 text-left font-medium text-fg">
                  {formatCalendarDate(r.date, "d MMM yyyy")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.landing_page_visits)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.unique_visitors)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.video_plays)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatPercentNullable(r.video_avg_watch_percent)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatPercentNullable(r.video_completion_rate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.form_starts)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.form_completions)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
