-- Leads CRM table. This dashboard is the system of record for lead status.
-- GHL is email sequences only; runmoreads.in posts into /api/ingest/*.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  ghl_contact_id text,
  name text,
  phone text,
  created_at timestamptz not null default now(),

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ad_set_id text,
  lead_source text,

  describes_you text,
  biggest_goal text,
  monthly_revenue text,
  investment_capacity text,

  form_filled_at timestamptz,
  form_answers jsonb,

  qualified boolean,
  qualified_at timestamptz,
  qualified_by text,

  call_booked_at timestamptz,
  call_scheduled_for timestamptz,
  cal_com_booking_id text,
  call_cancelled_at timestamptz,

  setter_verified boolean,
  setter_verified_at timestamptz,
  setter_verified_by text,

  reminder_sent boolean default false,
  reminder_sent_at timestamptz,

  call_showed boolean,
  call_showed_at timestamptz,
  call_showed_by text,

  deal_closed boolean,
  deal_value numeric,
  closed_at timestamptz,
  closed_by text,

  notes text,
  stage text,

  updated_at timestamptz not null default now()
);

create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_lead_source_idx on leads (lead_source);
create index if not exists leads_created_at_idx on leads (created_at);
