-- Composite indexes for org-scoped list/date filters.
-- Safe to apply on live DB (IF NOT EXISTS). Prefer CONCURRENTLY in production
-- if you run these manually outside a migration transaction.

create index if not exists leads_org_id_created_at_idx
  on public.leads (org_id, created_at desc);

create index if not exists leads_org_id_action_status_idx
  on public.leads (org_id, action_status);

create index if not exists meta_ads_daily_ad_account_id_date_idx
  on public.meta_ads_daily (ad_account_id, date);
