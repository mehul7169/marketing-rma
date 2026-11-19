/**
 * Structured custom filter <-> URL `cf` param (base64url JSON).
 * Validated against filterFields.ts before it ever reaches the query builder.
 */

import {
  FILTER_OP_LABELS,
  opsForField,
  resolveFilterField,
  type FilterFieldDef,
  type FilterOp
} from "@/lib/leads/filterFields";

export const CUSTOM_FILTER_PARAM = "cf";
export const MAX_CUSTOM_CONDITIONS = 20;
export const MAX_CF_PARAM_LENGTH = 8000;

export type CustomFilterMatch = "all" | "any";

export type CustomFilterCondition = {
  id: string;
  field: string;
  op: FilterOp;
  value?: unknown;
};

export type CustomFilter = {
  match: CustomFilterMatch;
  conditions: CustomFilterCondition[];
};

type WireCondition = { f: string; o: string; v?: unknown };
type WireFilter = { m: CustomFilterMatch; c: WireCondition[] };

export type CustomFilterError = { ok: false; error: string };
export type CustomFilterOk = { ok: true; filter: CustomFilter };

function newId(): string {
  return `c${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyCustomFilter(): CustomFilter {
  return { match: "all", conditions: [] };
}

export function isCustomFilterEmpty(filter: CustomFilter | null | undefined): boolean {
  return !filter || filter.conditions.length === 0;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string): string | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeCustomFilter(filter: CustomFilter): string | null {
  const conditions = filter.conditions.filter((c) => c.field && c.op);
  if (conditions.length === 0) return null;
  const wire: WireFilter = {
    m: filter.match === "any" ? "any" : "all",
    c: conditions.map((c) => {
      const row: WireCondition = { f: c.field, o: c.op };
      if (c.value !== undefined) row.v = c.value;
      return row;
    })
  };
  return toBase64Url(JSON.stringify(wire));
}

export function decodeCustomFilterParam(raw: string | null | undefined): CustomFilter | null {
  if (!raw || !raw.trim()) return null;
  if (raw.length > MAX_CF_PARAM_LENGTH) return null;
  const json = fromBase64Url(raw.trim());
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as WireFilter;
    if (!parsed || (parsed.m !== "all" && parsed.m !== "any") || !Array.isArray(parsed.c)) {
      return null;
    }
    const conditions: CustomFilterCondition[] = [];
    for (const row of parsed.c.slice(0, MAX_CUSTOM_CONDITIONS)) {
      if (!row || typeof row.f !== "string" || typeof row.o !== "string") continue;
      conditions.push({
        id: newId(),
        field: row.f,
        op: row.o as FilterOp,
        value: row.v
      });
    }
    if (conditions.length === 0) return null;
    return { match: parsed.m, conditions };
  } catch {
    return null;
  }
}

const OPS_NO_VALUE = new Set<FilterOp>([
  "is_empty",
  "is_not_empty",
  "is_blank",
  "is_yes",
  "is_no"
]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x).trim()).filter(Boolean);
  return out.length ? out : null;
}

function asYmd(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function validateValue(field: FilterFieldDef, op: FilterOp, value: unknown): string | null {
  if (OPS_NO_VALUE.has(op)) return null;
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2) return "between needs two values";
    if (field.type === "number") {
      if (!isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) return "between needs two numbers";
      return null;
    }
    if (field.type === "datetime") {
      if (!asYmd(value[0]) || !asYmd(value[1])) return "between needs two dates";
      return null;
    }
    return "between is not valid for this field";
  }
  if (op === "in_last" || op === "in_next") {
    if (!isFiniteNumber(value) || value < 1 || value > 365 || !Number.isInteger(value)) {
      return `${op} needs an integer 1–365`;
    }
    return null;
  }
  if (op === "is_any" || op === "is_none") {
    if (!asStringArray(value)) return `${op} needs at least one value`;
    return null;
  }
  if (field.type === "number" || op === "eq" || op === "neq" || op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    if (field.type === "number" && !isFiniteNumber(value)) return "expected a number";
  }
  if (field.type === "datetime" && (op === "before" || op === "after")) {
    if (!asYmd(value)) return "expected a date";
    return null;
  }
  if (field.type === "text" || op === "contains" || op === "not_contains" || op === "is" || op === "is_not") {
    if (typeof value !== "string" || !value.trim()) return "expected a non-empty string";
  }
  return null;
}

export function validateCustomFilter(input: unknown): CustomFilterOk | CustomFilterError {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "filter must be an object" };
  }
  const match = (input as { match?: unknown }).match;
  if (match !== "all" && match !== "any") {
    return { ok: false, error: "match must be all or any" };
  }
  const raw = (input as { conditions?: unknown }).conditions;
  if (!Array.isArray(raw)) return { ok: false, error: "conditions must be an array" };
  if (raw.length > MAX_CUSTOM_CONDITIONS) {
    return { ok: false, error: `at most ${MAX_CUSTOM_CONDITIONS} conditions` };
  }
  const conditions: CustomFilterCondition[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") {
      return { ok: false, error: `condition ${i + 1} is invalid` };
    }
    const fieldId = (row as { field?: unknown }).field;
    const op = (row as { op?: unknown }).op;
    if (typeof fieldId !== "string") return { ok: false, error: `condition ${i + 1}: unknown field` };
    const field = resolveFilterField(fieldId);
    if (!field) return { ok: false, error: `unknown field: ${fieldId}` };
    if (typeof op !== "string" || !opsForField(field).includes(op as FilterOp)) {
      return { ok: false, error: `unknown operator '${String(op)}' for ${field.label}` };
    }
    const value = (row as { value?: unknown }).value;
    const valueErr = validateValue(field, op as FilterOp, value);
    if (valueErr) return { ok: false, error: `${field.label}: ${valueErr}` };
    conditions.push({
      id: typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : newId(),
      field: field.id,
      op: op as FilterOp,
      value
    });
  }
  return { ok: true, filter: { match, conditions } };
}

export function parseCustomFilterParam(
  raw: string | string[] | undefined | null
): CustomFilter | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const decoded = decodeCustomFilterParam(s);
  if (!decoded) return null;
  const checked = validateCustomFilter(decoded);
  return checked.ok ? checked.filter : null;
}

export type CustomFilterYield = {
  dead: boolean;
  formQualified: boolean;
};

export function customFilterYields(filter: CustomFilter | null | undefined): CustomFilterYield {
  const out: CustomFilterYield = { dead: false, formQualified: false };
  if (!filter) return out;
  for (const c of filter.conditions) {
    const field = resolveFilterField(c.field);
    if (field?.yields === "dead") out.dead = true;
    if (field?.yields === "form_qualified") out.formQualified = true;
  }
  return out;
}

export function yieldNote(y: CustomFilterYield): string | null {
  if (y.dead && y.formQualified) {
    return "Including dead and form-unqualified leads because your filter uses Deal / Dead and Form Qualified.";
  }
  if (y.dead) return "Including dead leads because your filter uses Deal or Dead.";
  if (y.formQualified) {
    return "Including form-unqualified leads because your filter uses Form Qualified.";
  }
  return null;
}

function formatValue(field: FilterFieldDef, op: FilterOp, value: unknown): string {
  if (OPS_NO_VALUE.has(op)) return "";
  if (op === "between" && Array.isArray(value)) return `${value[0]}–${value[1]}`;
  if (op === "in_last" || op === "in_next") return String(value);
  if (op === "is_any" || op === "is_none") {
    const labels = (asStringArray(value) ?? []).map((v) => {
      const opt = field.enumValues?.find((o) => o.value === v);
      return opt?.label ?? v;
    });
    return labels.join(", ");
  }
  if (field.type === "datetime") return String(value);
  if (typeof value === "string") return value;
  return String(value ?? "");
}

export function customConditionChipLabel(condition: CustomFilterCondition): string {
  const field = resolveFilterField(condition.field);
  const name = field?.label ?? condition.field;
  const op = FILTER_OP_LABELS[condition.op] ?? condition.op;
  if (OPS_NO_VALUE.has(condition.op)) return `${name} ${op}`;
  if (condition.op === "in_last") return `${name} in the last ${condition.value} days`;
  if (condition.op === "in_next") return `${name} in the next ${condition.value} days`;
  const rest = field ? formatValue(field, condition.op, condition.value) : String(condition.value ?? "");
  if (condition.op === "is_any") {
    const n = Array.isArray(condition.value) ? condition.value.filter(Boolean).length : 0;
    return n <= 1 ? `${name} is ${rest}` : `${name} is any of ${rest}`;
  }
  return `${name} ${op} ${rest}`.trim();
}

export function removeCondition(filter: CustomFilter, id: string): CustomFilter {
  return { ...filter, conditions: filter.conditions.filter((c) => c.id !== id) };
}

export function blankCondition(): CustomFilterCondition {
  return { id: newId(), field: "", op: "contains", value: "" };
}
