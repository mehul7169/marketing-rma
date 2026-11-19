import { requireOrgId } from "@/lib/auth/getCurrentOrgId";
import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { getCurrentSession } from "@/lib/auth/session";
import { listFilterEnumValues, type FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import { listDistinctCustomFieldKeys } from "@/lib/db/leads";
import { firstAdminUserIdForOrg, getMembershipRole } from "@/lib/db/memberships";
import { ensureRmaSharedFilters, listNamedFiltersForUser } from "@/lib/db/namedFilters";
import type { NamedLeadFilter } from "@/lib/leads/namedFilters";
import { redirect } from "next/navigation";
import { getTableViewFilters, getTableViewForUser } from "@/lib/db/table_views";
import {
  hasExplicitFilterParams,
  parsePersistedFilterState,
  restoreHref
} from "@/lib/table-views/filterState";
import { humanizeFieldKey } from "@/lib/leads/customFields";
import {
  defaultColumnsForPage,
  fixedColumnsForPage,
  isTableViewPageKey,
  LEADS_BACKED_PAGE_KEYS
} from "@/lib/table-views/registry";
import {
  customFieldColumnId,
  mergeColumnsWithDefaults,
  type AvailableColumn,
  type TableColumnConfig,
  type TableViewBootstrap,
  type TableViewConfig
} from "@/lib/table-views/types";

export type { TableViewBootstrap };

export async function listAvailableColumnsForPage(
  pageKey: string,
  opts?: { orgId?: string; isPlatformAdmin?: boolean }
): Promise<AvailableColumn[]> {
  if (!isTableViewPageKey(pageKey)) return [];
  const admin =
    opts?.isPlatformAdmin !== undefined
      ? opts.isPlatformAdmin
      : await isPlatformAdmin();
  const fixed = fixedColumnsForPage(pageKey, { isPlatformAdmin: admin });
  const columns: AvailableColumn[] = fixed.map((c) => ({
    id: c.id,
    label: c.label,
    source: "fixed" as const
  }));

  if (LEADS_BACKED_PAGE_KEYS.has(pageKey)) {
    const orgId = opts?.orgId ?? (await requireOrgId());
    const keys = await listDistinctCustomFieldKeys(orgId);
    for (const key of keys) {
      columns.push({
        id: customFieldColumnId(key),
        label: humanizeFieldKey(key),
        source: "custom_field"
      });
    }
  }

  return columns;
}

/**
 * Redirects to the user's remembered filters when the URL has none.
 * Explicit params (shared / cohort links, in-app nav) always win.
 */
export async function restorePersistedFilters(
  pageKey: string,
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
  orgId: string
): Promise<void> {
  if (hasExplicitFilterParams(pageKey, searchParams)) return;
  const session = await getCurrentSession();
  if (!session) return;
  const saved = parsePersistedFilterState(
    pageKey,
    await getTableViewFilters(session.userId, pageKey, orgId)
  );
  const href = restoreHref(pathname, saved);
  if (href) redirect(href);
}

/**
 * Server-side bootstrap for useTableView — no client round-trip flash.
 * Returns null when unauthenticated (caller should fall back to defaults).
 */
export async function loadTableViewBootstrap(
  pageKey: string,
  opts?: { orgId?: string }
): Promise<TableViewBootstrap | null> {
  if (!isTableViewPageKey(pageKey)) return null;
  const [session, admin] = await Promise.all([
    getCurrentSession(),
    isPlatformAdmin()
  ]);
  if (!session) return null;

  const [savedRow, availableColumns] = await Promise.all([
    getTableViewForUser(session.userId, pageKey),
    listAvailableColumnsForPage(pageKey, {
      orgId: opts?.orgId,
      isPlatformAdmin: admin
    })
  ]);

  const defaults = defaultColumnsForPage(pageKey);
  const availableIds = availableColumns.map((c) => c.id);
  for (const d of defaults) {
    if (!availableIds.includes(d.id)) availableIds.push(d.id);
  }
  const savedConfig = savedRow?.config ?? null;
  const columns = mergeColumnsWithDefaults(savedConfig, defaults, availableIds);

  return {
    pageKey,
    columns,
    availableColumns,
    savedConfig
  };
}

export type FilterBuilderContext = {
  customKeys: string[];
  enumValues: FilterEnumValueMap;
  namedFilters: NamedLeadFilter[];
  canManageShared: boolean;
};

export async function loadFilterBuilderContext(
  pageKey: "leads" | "leads-queue",
  orgId: string,
  orgSlug: string | null
): Promise<FilterBuilderContext> {
  const session = await getCurrentSession();
  const [customKeys, enumValues, role, platform, adminUserId] = await Promise.all([
    listDistinctCustomFieldKeys(orgId),
    listFilterEnumValues(orgId),
    session ? getMembershipRole(session.userId, orgId) : Promise.resolve(null),
    isPlatformAdmin(),
    firstAdminUserIdForOrg(orgId)
  ]);
  const canManageShared = role === "admin" || platform;
  if (orgSlug && adminUserId) {
    await ensureRmaSharedFilters({
      orgId,
      orgSlug,
      pageKey,
      adminUserId
    });
  }
  const namedFilters = session
    ? await listNamedFiltersForUser({ userId: session.userId, pageKey, orgId })
    : [];
  return { customKeys, enumValues, namedFilters, canManageShared };
}
