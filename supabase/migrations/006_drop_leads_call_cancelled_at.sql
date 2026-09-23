-- The cal.com cancellation relay (/api/ingest/booking-cancelled) was removed;
-- it never fired in production (0 rows ever set).
-- Apply only after the app build without call_cancelled_at is deployed.

alter table public.leads drop column if exists call_cancelled_at;
