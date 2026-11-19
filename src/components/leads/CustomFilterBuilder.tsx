"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import {
  blankCondition,
  customConditionChipLabel,
  emptyCustomFilter,
  encodeCustomFilter,
  isCustomFilterEmpty,
  removeCondition,
  validateCustomFilter,
  type CustomFilter,
  type CustomFilterCondition
} from "@/lib/leads/customFilter";
import {
  FILTER_FIELD_GROUPS,
  FILTER_OP_LABELS,
  fieldsForPicker,
  mergeEnumOptions,
  opsForField,
  resolveFilterField,
  type FilterFieldDef,
  type FilterOp
} from "@/lib/leads/filterFields";
import type { NamedLeadFilter } from "@/lib/leads/namedFilters";
import SavedFilterMenu from "@/components/leads/SavedFilterMenu";

function sameFilter(a: CustomFilter, b: CustomFilter): boolean {
  return encodeCustomFilter(a) === encodeCustomFilter(b);
}

function FieldPicker({
  fields,
  value,
  onChange
}: {
  fields: FilterFieldDef[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = fields.find((f) => f.id === value);
  const needle = q.trim().toLowerCase();
  const grouped = FILTER_FIELD_GROUPS.map((group) => ({
    group,
    items: fields.filter(
      (f) =>
        f.group === group &&
        (!needle ||
          f.label.toLowerCase().includes(needle) ||
          f.id.toLowerCase().includes(needle))
    )
  })).filter((g) => g.items.length > 0);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="cf-field"
        className="min-w-[9rem] rounded-sm border border-slate-200 bg-white px-2 py-1 text-left text-xs text-slate-800"
        onClick={() => setOpen((v) => !v)}
      >
        {selected?.label ?? "Field"}
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-64 rounded border border-slate-200 bg-white p-2 shadow-sm">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fields"
            className="mb-2 w-full rounded-sm border border-slate-200 px-2 py-1 text-xs"
          />
          <div className="max-h-56 overflow-y-auto">
            {grouped.map((g) => (
              <div key={g.group} className="mb-2">
                <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {g.group}
                </p>
                {g.items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`block w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-slate-50 ${
                      f.id === value ? "bg-sky-50 text-sky-950" : "text-slate-800"
                    }`}
                    onClick={() => {
                      onChange(f.id);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ValueInput({
  field,
  condition,
  enumLive,
  onChange,
  onEnter
}: {
  field: FilterFieldDef;
  condition: CustomFilterCondition;
  enumLive: string[] | undefined;
  onChange: (value: unknown) => void;
  onEnter: () => void;
}) {
  const op = condition.op;
  if (
    op === "is_empty" ||
    op === "is_not_empty" ||
    op === "is_blank" ||
    op === "is_yes" ||
    op === "is_no"
  ) {
    return null;
  }
  if (op === "in_last" || op === "in_next") {
    return (
      <input
        type="number"
        min={1}
        max={365}
        data-testid="cf-value"
        className="w-20 rounded-sm border border-slate-200 px-2 py-1 text-xs"
        value={typeof condition.value === "number" ? condition.value : 14}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    );
  }
  if (op === "between" && field.type === "number") {
    const pair = Array.isArray(condition.value) ? condition.value : [0, 0];
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          data-testid="cf-value-min"
          className="w-20 rounded-sm border border-slate-200 px-2 py-1 text-xs"
          value={pair[0] ?? ""}
          onChange={(e) => onChange([Number(e.target.value), Number(pair[1] ?? 0)])}
        />
        <span className="text-slate-400">–</span>
        <input
          type="number"
          data-testid="cf-value-max"
          className="w-20 rounded-sm border border-slate-200 px-2 py-1 text-xs"
          value={pair[1] ?? ""}
          onChange={(e) => onChange([Number(pair[0] ?? 0), Number(e.target.value)])}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
        />
      </span>
    );
  }
  if (op === "between" && field.type === "datetime") {
    const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="date"
          className="rounded-sm border border-slate-200 px-2 py-1 text-xs"
          value={String(pair[0] ?? "")}
          onChange={(e) => onChange([e.target.value, String(pair[1] ?? "")])}
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          className="rounded-sm border border-slate-200 px-2 py-1 text-xs"
          value={String(pair[1] ?? "")}
          onChange={(e) => onChange([String(pair[0] ?? ""), e.target.value])}
        />
      </span>
    );
  }
  if (field.type === "datetime") {
    return (
      <input
        type="date"
        data-testid="cf-value"
        className="rounded-sm border border-slate-200 px-2 py-1 text-xs"
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        data-testid="cf-value"
        className="w-24 rounded-sm border border-slate-200 px-2 py-1 text-xs"
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    );
  }
  if (field.type === "enum" && (op === "is_any" || op === "is_none")) {
    const options = mergeEnumOptions(field, enumLive);
    const selected = Array.isArray(condition.value) ? (condition.value as string[]) : [];
    return (
      <select
        multiple
        data-testid="cf-value"
        className="max-h-24 min-w-[10rem] rounded-sm border border-slate-200 bg-white px-1 py-1 text-xs"
        value={selected}
        onChange={(e) =>
          onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
        }
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      data-testid="cf-value"
      className="min-w-[8rem] rounded-sm border border-slate-200 px-2 py-1 text-xs"
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

export default function CustomFilterBuilder({
  pageKey,
  filter,
  customKeys,
  enumValues,
  namedFilters,
  canManageShared,
  currentQuery,
  yieldNoteText,
  onApply
}: {
  pageKey: "leads" | "leads-queue";
  filter: CustomFilter | null;
  customKeys: string[];
  enumValues: FilterEnumValueMap;
  namedFilters: NamedLeadFilter[];
  canManageShared: boolean;
  currentQuery: Record<string, string>;
  yieldNoteText: string | null;
  onApply: (next: CustomFilter | null) => void;
}) {
  const applied = filter ?? emptyCustomFilter();
  const [draft, setDraft] = useState<CustomFilter>(applied);
  const [open, setOpen] = useState(!isCustomFilterEmpty(applied));
  const appliedKey = encodeCustomFilter(applied) ?? "";

  useEffect(() => {
    setDraft(applied);
    if (!isCustomFilterEmpty(applied)) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  const fields = useMemo(() => fieldsForPicker(customKeys), [customKeys]);
  const dirty = !sameFilter(draft, applied);

  function setCondition(id: string, patch: Partial<CustomFilterCondition>) {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c))
    }));
  }

  function applyDraft() {
    const ready: CustomFilter = {
      match: draft.match,
      conditions: draft.conditions.filter((c) => {
        if (!c.field || !c.op) return false;
        return Boolean(resolveFilterField(c.field));
      })
    };
    if (ready.conditions.length === 0) {
      onApply(null);
      return;
    }
    const checked = validateCustomFilter(ready);
    if (!checked.ok) return;
    onApply(checked.filter);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="cf-add"
          className="rounded-sm border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
          onClick={() => {
            setOpen(true);
            setDraft((prev) => ({
              ...prev,
              conditions: [...prev.conditions, blankCondition()]
            }));
          }}
        >
          + Filter
        </button>
        <SavedFilterMenu
          pageKey={pageKey}
          items={namedFilters}
          canManageShared={canManageShared}
          currentQuery={currentQuery}
        />
        {open ? (
          <>
            <div
              className="inline-flex overflow-hidden rounded-sm border border-slate-200"
              role="group"
              aria-label="Match mode"
            >
              {(["all", "any"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`cf-match-${m}`}
                  className={`px-2.5 py-1 text-xs ${
                    draft.match === m
                      ? "bg-sky-100 font-medium text-sky-950"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setDraft((p) => ({ ...p, match: m }))}
                >
                  {m === "all" ? "Match all" : "Match any"}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="cf-apply"
              disabled={!dirty && draft.conditions.length === 0}
              className="rounded-sm border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950 disabled:opacity-50"
              onClick={applyDraft}
            >
              Apply
            </button>
          </>
        ) : null}
      </div>

      {open && draft.conditions.length > 0 ? (
        <div className="space-y-2" data-testid="cf-rows">
          {draft.conditions.map((c) => {
            const field = c.field ? resolveFilterField(c.field) : null;
            const ops = field ? opsForField(field) : [];
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <FieldPicker
                  fields={fields}
                  value={c.field}
                  onChange={(id) => {
                    const next = resolveFilterField(id);
                    const op = next ? opsForField(next)[0] : "contains";
                    setCondition(c.id, { field: id, op, value: undefined });
                  }}
                />
                {field ? (
                  <select
                    data-testid="cf-op"
                    className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-xs"
                    value={c.op}
                    onChange={(e) =>
                      setCondition(c.id, { op: e.target.value as FilterOp, value: undefined })
                    }
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {FILTER_OP_LABELS[op]}
                      </option>
                    ))}
                  </select>
                ) : null}
                {field ? (
                  <ValueInput
                    field={field}
                    condition={c}
                    enumLive={field.enumSource ? enumValues[field.enumSource] : undefined}
                    onChange={(value) => setCondition(c.id, { value })}
                    onEnter={applyDraft}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${customConditionChipLabel(c)}`}
                  className="rounded-sm px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                  onClick={() =>
                    setDraft((p) => {
                      const next = removeCondition(p, c.id);
                      if (next.conditions.length === 0) setOpen(false);
                      return next;
                    })
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {yieldNoteText ? (
        <p className="text-xs text-slate-500" data-testid="cf-yield-note">
          {yieldNoteText}
        </p>
      ) : null}
    </div>
  );
}
