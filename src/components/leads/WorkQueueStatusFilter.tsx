"use client";

const FILTERS = [
  { id: "", label: "All active" },
  { id: "untouched", label: "Untouched" },
  { id: "personally_contacted", label: "Personally Contacted" },
  { id: "upcoming", label: "Upcoming" }
] as const;

/**
 * Status filter for Work Queue — mutually exclusive with primary tabs.
 * Selecting a filter clears the tab, resets page, and reloads the queue.
 */
export default function WorkQueueStatusFilter({
  view,
  value,
  search = "",
  disabled = false
}: {
  view: string;
  value: string | null;
  search?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-xs ${
        disabled ? "text-slate-400" : "text-slate-600"
      }`}
    >
      <span className="whitespace-nowrap">Filter</span>
      <select
        className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        value={value ?? ""}
        disabled={disabled}
        title={
          disabled
            ? "Clear the tab above to use status filters"
            : "Narrow the all-active queue"
        }
        onChange={(e) => {
          const next = e.target.value;
          const url = new URL(window.location.href);
          url.searchParams.set("view", view);
          url.searchParams.delete("tab");
          url.searchParams.delete("page");
          if (next) url.searchParams.set("filter", next);
          else url.searchParams.delete("filter");
          if (search.trim()) url.searchParams.set("search", search.trim());
          else url.searchParams.delete("search");
          window.location.href = url.pathname + url.search;
        }}
      >
        {FILTERS.map((f) => (
          <option key={f.id || "all"} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}
