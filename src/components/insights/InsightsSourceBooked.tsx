import type { SourceBookedRow } from "@/lib/insights/metrics";
import { formatInteger } from "@/lib/format";

export default function InsightsSourceBooked({ rows }: { rows: SourceBookedRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.callsBooked), 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">No booked calls in this range.</p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? (row.callsBooked / max) * 100 : 0;
        return (
          <div key={row.source}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-900">{row.source}</span>
              <span className="tabular-nums text-slate-700">
                {formatInteger(row.callsBooked)}
              </span>
            </div>
            <div className="mt-1 h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded bg-blue-700"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
