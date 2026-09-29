import { formatInteger } from "@/lib/format";
import type {
  SetterActivityCounts,
  SetterActivityReport
} from "@/lib/insights/setterActivity";
import { formatCalendarDate } from "@/lib/timezone";

const COLUMNS: Array<{ key: keyof SetterActivityCounts; label: string }> = [
  { key: "dials", label: "Total Dials" },
  { key: "callsBooked", label: "Calls Booked" },
  { key: "noAnswer", label: "No Answer" },
  { key: "unqualified", label: "Unqualified" },
  { key: "followUp", label: "Follow-up" }
];

function CountCells({ c }: { c: SetterActivityCounts }) {
  return (
    <>
      {COLUMNS.map((col) => (
        <td key={col.key} className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
          {formatInteger(c[col.key])}
        </td>
      ))}
    </>
  );
}

function ActivityTable({
  firstHeader,
  rows,
  totals,
  empty
}: {
  firstHeader: string;
  rows: Array<{ key: string; label: string; counts: SetterActivityCounts }>;
  totals: SetterActivityCounts;
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <th className="px-4 py-3 text-left">{firstHeader}</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3 text-right">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap px-4 py-3 text-left text-slate-900">{r.label}</td>
                <CountCells c={r.counts} />
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium text-slate-900">
              <td className="px-4 py-3 text-left">Total</td>
              <CountCells c={totals} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export default function InsightsSetterActivity({ report }: { report: SetterActivityReport }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Organization — by day
        </h3>
        <ActivityTable
          firstHeader="Date (IST)"
          rows={report.daily.map((d) => ({
            key: d.date,
            label: formatCalendarDate(d.date, "EEE d MMM"),
            counts: d
          }))}
          totals={report.orgTotals}
          empty="No calls logged in this range."
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          By setter
        </h3>
        <ActivityTable
          firstHeader="Setter"
          rows={report.users.map((u) => ({
            key: u.userId ?? "unknown",
            label: u.label,
            counts: u
          }))}
          totals={report.userTotals}
          empty="No calls logged in this range."
        />
      </div>
    </div>
  );
}
