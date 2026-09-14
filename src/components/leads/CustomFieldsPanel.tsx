import type { ReactNode } from "react";
import { humanizeFieldKey } from "@/lib/leads/customFields";

/**
 * Renders arbitrary lead.custom_fields entries with humanized labels.
 * Unknown keys appear without code changes — only non-empty values shown.
 */
export default function CustomFieldsPanel({
  customFields,
  emptyMessage = "No form details yet.",
  className = "grid grid-cols-2 gap-4"
}: {
  customFields: Record<string, unknown> | null | undefined;
  emptyMessage?: string;
  className?: string;
}) {
  const entries = Object.entries(customFields ?? {}).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && !value.trim()) return false;
    return true;
  });

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className={className}>
      {entries.map(([key, value]) => (
        <Field
          key={key}
          label={humanizeFieldKey(key)}
          value={
            typeof value === "string"
              ? value
              : typeof value === "number" || typeof value === "boolean"
                ? String(value)
                : JSON.stringify(value)
          }
        />
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}
