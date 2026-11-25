"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Segmented from "@/components/ui/Segmented";
import { formatInrCompact, formatInteger } from "@/lib/format";
import type { SetterBoardRow } from "@/lib/home/assemble";
import type { CloserRow } from "@/lib/home/metrics";
import { cn } from "@/components/ui/cn";

const MODES = [
  { value: "setters", label: "Setters" },
  { value: "closers", label: "Closers" }
] as const;
type Mode = (typeof MODES)[number]["value"];

function Rank({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-pill px-1.5 text-xs font-semibold",
        n === 1 ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"
      )}
    >
      #{n}
    </span>
  );
}

function rate(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function HomeLeaderboard({
  setters,
  closers
}: {
  setters: SetterBoardRow[];
  closers: Array<CloserRow & { rank?: number }>;
}) {
  const [mode, setMode] = useState<Mode>("setters");

  return (
    <div data-testid="home-leaderboard">
      <Card
        title="Leaderboard"
        actions={
          <Segmented
            ariaLabel="Leaderboard"
            options={[...MODES]}
            value={mode}
            onChange={setMode}
          />
        }
      >
        {mode === "setters" ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 font-medium">Setter</th>
                <th className="pb-2 text-right font-medium">Dials</th>
                <th className="pb-2 text-right font-medium">Booked</th>
                <th className="pb-2 text-right font-medium">Booking rate</th>
              </tr>
            </thead>
            <tbody>
              {setters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted">
                    No dials in this range
                  </td>
                </tr>
              ) : (
                setters.map((row) => (
                  <tr key={row.userId ?? "unknown"} className="border-t border-subtle">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Rank n={row.rank} />
                        <span className="truncate">{row.label}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(row.dials)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(row.booked)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{rate(row.bookingRate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 font-medium">Closer</th>
                <th className="pb-2 text-right font-medium">Showups</th>
                <th className="pb-2 text-right font-medium">Won</th>
                <th className="pb-2 text-right font-medium">Close rate</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {closers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No showups in this range
                  </td>
                </tr>
              ) : (
                closers.map((row, i) => (
                  <tr key={row.ownerId ?? "unassigned"} className="border-t border-subtle">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Rank n={row.rank ?? i + 1} />
                        <span className="truncate">{row.label}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(row.showups)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(row.won)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {rate(row.closeRate)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInrCompact(row.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
