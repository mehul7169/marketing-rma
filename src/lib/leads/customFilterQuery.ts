/**
 * Translate a validated CustomFilter into PostgREST fragments.
 * AND = successive .or(single-group) ANDed with the rest of the query.
 * OR  = one .or() of grouped fragments. Values with , ( ) " are quoted.
 * Never interpolates into raw SQL.
 */

import type { CustomFilter, CustomFilterCondition } from "@/lib/leads/customFilter";
import { resolveFilterField, type FilterFieldDef } from "@/lib/leads/filterFields";
import {
  addIstCalendarDays,
  istDayEndUtcIso,
  istDayStartUtcIso,
  todayISTDateString
} from "@/lib/timezone";

/** Quote a PostgREST filter value when it contains reserved characters. */
export function encodePostgrestValue(value: string): string {
  if (/[,.()":*\\]/.test(value) || value === "" || /\s/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/** Escape LIKE / ILIKE wildcards in the user's value. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function colOf(field: FilterFieldDef): string {
  if (field.derived === "deal") return "deal_closed";
  if (!field.column) throw new Error(`field ${field.id} has no column`);
  return field.column;
}

function ymd(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("expected YYYY-MM-DD");
  }
  return value;
}

function num(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("expected a number");
  return value;
}

function str(value: unknown): string {
  if (typeof value !== "string") throw new Error("expected a string");
  return value;
}

function strs(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("expected a list");
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function wrapGroup(fragment: string): string {
  if (fragment.startsWith("or(") || fragment.startsWith("and(")) return fragment;
  if (!fragment.includes(",")) return fragment;
  return `or(${fragment})`;
}

function dealFragments(op: CustomFilterCondition["op"], value: unknown): string {
  const col = "deal_closed";
  const map: Record<string, string> = {
    won: `${col}.eq.true`,
    lost: `${col}.eq.false`,
    undecided: `${col}.is.null`
  };
  const partsFor = (ids: string[]) =>
    ids.map((id) => map[id]).filter(Boolean);

  if (op === "is_empty") return `${col}.is.null`;
  if (op === "is_any") {
    const parts = partsFor(strs(value));
    if (parts.length === 0) return `${col}.neq.${col}`; // match nothing
    return parts.length === 1 ? parts[0]! : `or(${parts.join(",")})`;
  }
  if (op === "is_none") {
    const exclude = new Set(strs(value));
    const rest = (["won", "lost", "undecided"] as const).filter((k) => !exclude.has(k));
    const parts = partsFor([...rest]);
    if (parts.length === 0) return `${col}.neq.${col}`;
    return parts.length === 1 ? parts[0]! : `or(${parts.join(",")})`;
  }
  throw new Error(`Deal does not support ${op}`);
}

export function conditionToFragment(
  condition: CustomFilterCondition,
  todayISO: string = todayISTDateString()
): string {
  const field = resolveFilterField(condition.field);
  if (!field) throw new Error(`unknown field: ${condition.field}`);
  if (field.derived === "deal") return dealFragments(condition.op, condition.value);

  const col = colOf(field);
  const op = condition.op;

  if (op === "is_empty") {
    if (field.type === "text") return `or(${col}.is.null,${col}.eq."")`;
    return `${col}.is.null`;
  }
  if (op === "is_not_empty") {
    if (field.type === "text") return `and(${col}.not.is.null,${col}.neq."")`;
    return `${col}.not.is.null`;
  }
  if (op === "is_blank") return `${col}.is.null`;
  if (op === "is_yes") return `${col}.eq.true`;
  if (op === "is_no") return `${col}.eq.false`;

  if (op === "contains") {
    const pattern = `%${escapeIlikePattern(str(condition.value).trim())}%`;
    return `${col}.ilike.${encodePostgrestValue(pattern)}`;
  }
  if (op === "not_contains") {
    const pattern = `%${escapeIlikePattern(str(condition.value).trim())}%`;
    return `or(${col}.is.null,${col}.eq."",${col}.not.ilike.${encodePostgrestValue(pattern)})`;
  }
  if (op === "is") return `${col}.eq.${encodePostgrestValue(str(condition.value))}`;
  if (op === "is_not") {
    return `or(${col}.is.null,${col}.eq."",${col}.neq.${encodePostgrestValue(str(condition.value))})`;
  }

  if (op === "eq") return `${col}.eq.${num(condition.value)}`;
  if (op === "neq") return `or(${col}.is.null,${col}.neq.${num(condition.value)})`;
  if (op === "gt") return `${col}.gt.${num(condition.value)}`;
  if (op === "gte") return `${col}.gte.${num(condition.value)}`;
  if (op === "lt") return `${col}.lt.${num(condition.value)}`;
  if (op === "lte") return `${col}.lte.${num(condition.value)}`;
  if (op === "between" && field.type === "number") {
    const [a, b] = condition.value as [number, number];
    const min = Math.min(num(a), num(b));
    const max = Math.max(num(a), num(b));
    return `and(${col}.gte.${min},${col}.lte.${max})`;
  }

  if (op === "before") return `${col}.lt.${istDayStartUtcIso(ymd(condition.value))}`;
  if (op === "after") return `${col}.gt.${istDayEndUtcIso(ymd(condition.value))}`;
  if (op === "between" && field.type === "datetime") {
    const [a, b] = condition.value as [string, string];
    const from = ymd(a) <= ymd(b) ? ymd(a) : ymd(b);
    const to = ymd(a) <= ymd(b) ? ymd(b) : ymd(a);
    return `and(${col}.gte.${istDayStartUtcIso(from)},${col}.lte.${istDayEndUtcIso(to)})`;
  }
  if (op === "in_last") {
    const n = num(condition.value);
    const from = addIstCalendarDays(todayISO, -(n - 1));
    return `and(${col}.gte.${istDayStartUtcIso(from)},${col}.lte.${istDayEndUtcIso(todayISO)})`;
  }
  if (op === "in_next") {
    const n = num(condition.value);
    const to = addIstCalendarDays(todayISO, n - 1);
    return `and(${col}.gte.${istDayStartUtcIso(todayISO)},${col}.lte.${istDayEndUtcIso(to)})`;
  }

  if (op === "is_any") {
    const values = strs(condition.value);
    if (values.length === 1) return `${col}.eq.${encodePostgrestValue(values[0]!)}`;
    return `${col}.in.(${values.map(encodePostgrestValue).join(",")})`;
  }
  if (op === "is_none") {
    const values = strs(condition.value);
    const notIn = `${col}.not.in.(${values.map(encodePostgrestValue).join(",")})`;
    return `or(${col}.is.null,${notIn})`;
  }

  throw new Error(`cannot translate ${field.id} ${op}`);
}

export function customFilterOrParam(
  filter: CustomFilter,
  todayISO: string = todayISTDateString()
): string | null {
  if (filter.conditions.length === 0) return null;
  const parts = filter.conditions.map((c) => wrapGroup(conditionToFragment(c, todayISO)));
  if (filter.match === "any") return parts.join(",");
  return null;
}

type OrCapable = { or: (expr: string) => unknown };

export function applyCustomFilter<Q extends OrCapable>(
  query: Q,
  filter: CustomFilter | null | undefined,
  todayISO: string = todayISTDateString()
): Q {
  if (!filter || filter.conditions.length === 0) return query;
  const parts = filter.conditions.map((c) => wrapGroup(conditionToFragment(c, todayISO)));
  if (filter.match === "any") {
    return query.or(parts.join(",")) as Q;
  }
  if (parts.length === 1) return query.or(parts[0]!) as Q;
  return query.or(`and(${parts.join(",")})`) as Q;
}
