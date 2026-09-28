-- Pre-extracted Meta `landing_page_view` action count (same pattern as
-- results / appointments_scheduled). Backfilled from the stored actions jsonb;
-- the hourly Meta cron populates it going forward.

alter table public.meta_ads_daily
  add column if not exists landing_page_views integer;

update public.meta_ads_daily m
set landing_page_views = s.views
from (
  select d.id, sum((a->>'value')::numeric)::integer as views
  from public.meta_ads_daily d
  cross join lateral jsonb_array_elements(d.actions) a
  where jsonb_typeof(d.actions) = 'array'
    and a->>'action_type' = 'landing_page_view'
  group by d.id
) s
where m.id = s.id;
