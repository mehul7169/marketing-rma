-- Debounce Slack alerts for failing crons.
-- Service role only (RLS on, no policies). Owner applies this; do not run from the app.

create table if not exists public.cron_alert_state (
  job text primary key,
  failing_since timestamptz not null,
  last_alert_at timestamptz not null
);

alter table public.cron_alert_state enable row level security;
