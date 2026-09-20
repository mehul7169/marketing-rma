-- Same as sql-fix-leads-email-uniqueness-per-org.sql (repo root).
-- leads email uniqueness is per-org, not global.

alter table public.leads drop constraint if exists leads_email_key;
drop index if exists public.leads_email_key;

alter table public.leads
  drop constraint if exists leads_org_id_email_key;

alter table public.leads
  add constraint leads_org_id_email_key unique (org_id, email);

create index if not exists leads_org_id_email_idx
  on public.leads (org_id, email);
