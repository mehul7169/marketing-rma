"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ActionPopover from "@/components/leads/ActionPopover";
import {
  CONTROL_H,
  FilterIcon,
  ToolbarGhostButton
} from "@/components/leads/FilterToolbar";
import { SEARCH_DEBOUNCE_MS } from "@/components/leads/useFilterSearch";
import type { FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import {
  blankCondition,
  completeCustomFilter,
  customConditionChipLabel,
  emptyCustomFilter,
  encodeCustomFilter,
  type CustomFilter,
  type CustomFilterCondition,
  type CustomFilterMatch
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

const CONTROL =
  `${CONTROL_H} rounded-sm border border-subtle bg-surface px-2 text-xs text-fg`;

function FieldSelect({
  fields,
  value,
  onChange
}: {
  fields: FilterFieldDef[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      data-testid="cf-field"
      className={`min-w-0 w-full ${CONTROL}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Field</option>
      {FILTER_FIELD_GROUPS.map((group) => {
        const items = fields.filter((f) => f.group === group);
        if (items.length === 0) return null;
        return (
          <optgroup key={group} label={group}>
            {items.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

function ValueInput({
  field,
  condition,
  enumLive,
  onChange
}: {
  field: FilterFieldDef;
  condition: CustomFilterCondition;
  enumLive: string[] | undefined;
  onChange: (value: unknown) => void;
}) {
  const op = condition.op;
  if (
    op === "is_empty" ||
    op === "is_not_empty" ||
    op === "is_blank" ||
    op === "is_yes" ||
    op === "is_no"
  ) {
    return <span />;
  }
  if (op === "in_last" || op === "in_next") {
    return (
      <input
        type="number"
        min={1}
        max={365}
        data-testid="cf-value"
        className={`w-full ${CONTROL}`}
        value={typeof condition.value === "number" ? condition.value : 14}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }
  if (op === "between" && field.type === "number") {
    const pair = Array.isArray(condition.value) ? condition.value : [0, 0];
    return (
      <span className="inline-flex w-full items-center gap-1">
        <input
          type="number"
          data-testid="cf-value-min"
          className={`min-w-0 flex-1 ${CONTROL}`}
          value={pair[0] ?? ""}
          onChange={(e) => onChange([Number(e.target.value), Number(pair[1] ?? 0)])}
        />
        <span className="text-muted">–</span>
        <input
          type="number"
          data-testid="cf-value-max"
          className={`min-w-0 flex-1 ${CONTROL}`}
          value={pair[1] ?? ""}
          onChange={(e) => onChange([Number(pair[0] ?? 0), Number(e.target.value)])}
        />
      </span>
    );
  }
  if (op === "between" && field.type === "datetime") {
    const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
    return (
      <span className="inline-flex w-full items-center gap-1">
        <input
          type="date"
          className={`min-w-0 flex-1 ${CONTROL}`}
          value={String(pair[0] ?? "")}
          onChange={(e) => onChange([e.target.value, String(pair[1] ?? "")])}
        />
        <span className="text-muted">–</span>
        <input
          type="date"
          className={`min-w-0 flex-1 ${CONTROL}`}
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
        className={`w-full ${CONTROL}`}
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
        className={`w-full ${CONTROL}`}
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
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
        className="max-h-24 min-h-8 w-full rounded-sm border border-subtle bg-surface px-1 py-1 text-xs"
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
      className={`w-full ${CONTROL}`}
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  testId
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  testId?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        className={`relative h-5 w-9 rounded-full ${
          checked ? "bg-accent" : "bg-surface-2"
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-[left] ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function CustomFilterBuilder({
  filter,
  customKeys,
  enumValues,
  onApply,
  open,
  onOpenChange,
  focusConditionId = null,
  seedBlank = false,
  addNonce = 0,
  activeCount = 0,
  showFormUnqualified,
  onShowFormUnqualifiedChange,
  formUnqualifiedEnabled = false,
  children
}: {
  filter: CustomFilter | null;
  customKeys: string[];
  enumValues: FilterEnumValueMap;
  onApply: (next: CustomFilter | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusConditionId?: string | null;
  seedBlank?: boolean;
  addNonce?: number;
  activeCount?: number;
  showFormUnqualified?: boolean;
  onShowFormUnqualifiedChange?: (next: boolean) => void;
  formUnqualifiedEnabled?: boolean;
  children?: ReactNode;
}) {
  const applied = filter ?? emptyCustomFilter();
  const appliedKey = encodeCustomFilter(applied) ?? "";
  const [draft, setDraft] = useState<CustomFilter>(applied);
  const initRef = useRef(false);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const appliedKeyRef = useRef(appliedKey);
  appliedKeyRef.current = appliedKey;

  useEffect(() => {
    if (!open) {
      initRef.current = false;
      return;
    }
    if (initRef.current) return;
    initRef.current = true;
    const base = filter ?? emptyCustomFilter();
    setDraft(
      seedBlank || base.conditions.length === 0
        ? { match: base.match, conditions: [...base.conditions, blankCondition()] }
        : { ...base }
    );
    // Only initialize when the popover opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedBlank]);

  useEffect(() => {
    if (addNonce === 0) return;
    setDraft((prev) => ({
      ...prev,
      conditions: [...prev.conditions, blankCondition()]
    }));
  }, [addNonce]);

  useEffect(() => {
    if (!open) return;
    const ready = completeCustomFilter(draft);
    const nextKey = ready ? encodeCustomFilter(ready) ?? "" : "";
    if (nextKey === appliedKeyRef.current) return;
    const t = window.setTimeout(() => {
      onApplyRef.current(ready);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [draft, open]);

  useEffect(() => {
    if (!open || !focusConditionId) return;
    const el = document.querySelector<HTMLElement>(
      `[data-cf-row="${focusConditionId}"] [data-testid="cf-field"]`
    );
    el?.focus();
  }, [open, focusConditionId, draft.conditions.length]);

  const fields = useMemo(() => fieldsForPicker(customKeys), [customKeys]);

  function setCondition(id: string, patch: Partial<CustomFilterCondition>) {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c))
    }));
  }

  function setMatch(match: CustomFilterMatch) {
    setDraft((p) => ({ ...p, match }));
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={onOpenChange}
      placement="bottom-start"
      widthClass="w-[min(40rem,calc(100vw-1rem))]"
      bodyClassName="p-3 overflow-visible"
      panelClassName="overflow-visible"
      labelledBy="cf-popover-title"
      trigger={
        <ToolbarGhostButton
          testId="cf-filter"
          label="Filter"
          icon={<FilterIcon />}
          count={activeCount || undefined}
          active={activeCount > 0}
          onClick={() => onOpenChange(!open)}
        />
      }
    >
      <div data-testid="cf-popover">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p id="cf-popover-title" className="text-sm text-fg">
            Match{" "}
            <select
              data-testid="cf-match"
              className={`${CONTROL_H} rounded-sm border border-subtle bg-surface px-1.5 text-sm text-fg`}
              value={draft.match}
              onChange={(e) => setMatch(e.target.value as CustomFilterMatch)}
            >
              <option value="all">all</option>
              <option value="any">any</option>
            </select>{" "}
            of these
          </p>
          {formUnqualifiedEnabled && onShowFormUnqualifiedChange ? (
            <ToggleSwitch
              checked={Boolean(showFormUnqualified)}
              onChange={onShowFormUnqualifiedChange}
              label="Include form-unqualified"
              testId="queue-show-unqualified"
            />
          ) : null}
        </div>

        {children}

        <div className="space-y-2" data-testid="cf-rows">
          {draft.conditions.map((c) => {
            const field = c.field ? resolveFilterField(c.field) : null;
            const ops = field ? opsForField(field) : [];
            return (
              <div
                key={c.id}
                data-cf-row={c.id}
                className="grid grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,0.9fr)_minmax(8rem,1.4fr)_auto] items-center gap-2"
              >
                <FieldSelect
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
                    className={`min-w-0 w-full ${CONTROL}`}
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
                ) : (
                  <span />
                )}
                {field ? (
                  <ValueInput
                    field={field}
                    condition={c}
                    enumLive={field.enumSource ? enumValues[field.enumSource] : undefined}
                    onChange={(value) => setCondition(c.id, { value })}
                  />
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  aria-label={`Remove ${customConditionChipLabel(c)}`}
                  className={`${CONTROL_H} rounded-sm px-1.5 text-muted hover:bg-surface-2 hover:text-fg`}
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      conditions: p.conditions.filter((row) => row.id !== c.id)
                    }))
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="cf-add"
          className="mt-3 text-xs text-muted hover:text-fg"
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              conditions: [...prev.conditions, blankCondition()]
            }))
          }
        >
          + Add condition
        </button>
      </div>
    </ActionPopover>
  );
}

