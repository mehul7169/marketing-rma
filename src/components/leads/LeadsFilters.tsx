"use client";

import { useRouter } from "next/navigation";
import { LEAD_STAGES } from "@/lib/leads/computeStage";
import { stageLabel } from "@/components/leads/StageBadge";

export default function LeadsFilters({
  sources,
  selectedStages,
  selectedSources,
  search,
  fromISO,
  toISO
}: {
  sources: string[];
  selectedStages: string[];
  selectedSources: string[];
  search: string;
  fromISO: string;
  toISO: string;
}) {
  const router = useRouter();

  function push(next: {
    stages?: string[];
    sources?: string[];
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();
    params.set("from", next.from ?? fromISO);
    params.set("to", next.to ?? toISO);
    const stages = next.stages ?? selectedStages;
    const srcs = next.sources ?? selectedSources;
    const q = next.q ?? search;
    if (stages.length) params.set("stage", stages.join(","));
    if (srcs.length) params.set("source", srcs.join(","));
    if (q) params.set("q", q);
    router.push(`/leads?${params.toString()}`);
  }

  const sourceKey = selectedSources.join(",").toLowerCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${sourceKey === "" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
          onClick={() => push({ sources: [] })}
        >
          All Leads
        </button>
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${sourceKey === "meta" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
          onClick={() => push({ sources: ["meta"] })}
        >
          Meta Ads
        </button>
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${sourceKey === "youtube" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
          onClick={() => push({ sources: ["youtube"] })}
        >
          YouTube
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[220px] flex-1 flex-col text-xs text-slate-600">
          Search name or email
          <input
            defaultValue={search}
            className="mt-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
            placeholder="Search"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                push({ q: (e.target as HTMLInputElement).value });
              }
            }}
            onBlur={(e) => push({ q: e.target.value })}
          />
        </label>

        <label className="flex flex-col text-xs text-slate-600">
          Stage
          <select
            multiple
            className="mt-1 h-24 min-w-[160px] rounded border border-slate-200 px-2 py-1 text-sm"
            value={selectedStages}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((o) => o.value);
              push({ stages: values });
            }}
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs text-slate-600">
          Source
          <select
            multiple
            className="mt-1 h-24 min-w-[160px] rounded border border-slate-200 px-2 py-1 text-sm"
            value={selectedSources}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((o) => o.value);
              push({ sources: values });
            }}
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
