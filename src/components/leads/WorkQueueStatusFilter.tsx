"use client";

const FILTERS = [
  { id: "", label: "All" },
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "upcoming", label: "Follow-up upcoming" }
] as const;

/**
 * Status filter for Work Queue — mutually exclusive with Meetings / Follow-ups.
 */
export default function WorkQueueStatusFilter({
  value,
  disabled = false,
  onChange
}: {
  value: string | null;
  disabled?: boolean;
  onChange: (filterId: string) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-xs ${
        disabled ? "text-slate-400" : "text-slate-600"
      }`}
    >
      <span className="whitespace-nowrap">Filter</span>
      <select
        data-testid="queue-filter"
        className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        value={value ?? ""}
        disabled={disabled}
        title={
          disabled
            ? "Clear the tab above to use status filters"
            : "Narrow the queue"
        }
        onChange={(e) => onChange(e.target.value)}
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
