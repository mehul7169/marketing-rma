-- Fix: leads email uniqueness is per-org, not global.
-- Prerequisite for /api/ingest/quickform-lead upsert on (org_id, email).
--
-- Before: email text UNIQUE (global) — same person as a lead in RMA and a
-- client org could not both exist; second ingest hit 409 and was dropped.
-- After: UNIQUE (org_id, email) — matches how the rest of the app is org-scoped.

-- Drop the global unique constraint / index on email (name varies by how it was created).
alter table public.leads drop constraint if exists leads_email_key;
drop index if exists public.leads_email_key;

-- Prefer a named unique constraint so PostgREST onConflict: 'org_id,email' resolves cleanly.
alter table public.leads
  drop constraint if exists leads_org_id_email_key;

alter table public.leads
  add constraint leads_org_id_email_key unique (org_id, email);

-- Helpful for lookups that filter by org then email (getLeadByEmail).
create index if not exists leads_org_id_email_idx
  on public.leads (org_id, email);
