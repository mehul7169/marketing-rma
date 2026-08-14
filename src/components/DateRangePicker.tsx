"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function isoToLocalDateValue(iso: string) {
  // iso is YYYY-MM-DD; <input type="date"> expects that exact format.
  return iso;
}

export default function DateRangePicker({
  fromISO,
  toISO,
  hasCustomRange,
  extraParams,
  pathname
}: {
  fromISO: string;
  toISO: string;
  hasCustomRange: boolean;
  extraParams?: Record<string, string | undefined>;
  pathname?: string;
}) {
  const router = useRouter();

  const initial = useMemo(() => ({ fromISO, toISO }), [fromISO, toISO]);

  const [from, setFrom] = useState(initial.fromISO);
  const [to, setTo] = useState(initial.toISO);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        params.set("from", from);
        params.set("to", to);
        for (const [key, value] of Object.entries(extraParams ?? {})) {
          if (value) params.set(key, value);
        }
        const path = pathname ?? "";
        router.push(`${path}?${params.toString()}`);
      }}
    >
      <div className="flex flex-col">
        <label className="text-xs text-slate-600">From (IST)</label>
        <input
          className="mt-1 w-40 rounded border border-slate-200 px-2 py-2 text-sm text-slate-900"
          type="date"
          value={isoToLocalDateValue(from)}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-600">To (IST)</label>
        <input
          className="mt-1 w-40 rounded border border-slate-200 px-2 py-2 text-sm text-slate-900"
          type="date"
          value={isoToLocalDateValue(to)}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Update
        </button>
        {hasCustomRange ? (
          <div className="mt-1 text-[11px] text-slate-500">
            Range via query params
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-slate-500">
            Default: last 30 days (IST)
          </div>
        )}
      </div>
    </form>
  );
}

