"use client";

import { useRouter } from "next/navigation";

export default function InsightsFilters({
  sources,
  selectedSources,
  fromISO,
  toISO
}: {
  sources: string[];
  selectedSources: string[];
  fromISO: string;
  toISO: string;
}) {
  const router = useRouter();

  function push(nextSources: string[]) {
    const params = new URLSearchParams();
    params.set("from", fromISO);
    params.set("to", toISO);
    if (nextSources.length) params.set("source", nextSources.join(","));
    router.push(`/insights?${params.toString()}`);
  }

  return (
    <label className="flex flex-col text-xs text-slate-600">
      Source
      <select
        multiple
        className="mt-1 h-24 min-w-[160px] rounded border border-slate-200 px-2 py-1 text-sm"
        value={selectedSources}
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map((o) => o.value);
          push(values);
        }}
      >
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="mt-1 text-slate-500">
        {selectedSources.length ? "Filtering selected sources" : "All sources (select to filter)"}
      </span>
    </label>
  );
}
