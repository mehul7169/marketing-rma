-- Switch meta_ads_daily from ad-set grain to ad grain.
-- Run this in the Supabase SQL editor before the Meta ad-level backfill.

alter table meta_ads_daily
  add column if not exists ad_id text,
  add column if not exists ad_name text,
  add column if not exists creative_thumbnail_url text;

-- Drop the old unique (date, ad_set_id) — name may vary.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'meta_ads_daily'::regclass
      and contype = 'u'
  loop
    execute format('alter table meta_ads_daily drop constraint %I', c.conname);
  end loop;
end $$;

-- Fresh load at ad level; old ad-set rows would collide or be incomplete.
truncate table meta_ads_daily;

alter table meta_ads_daily
  alter column ad_id set not null;

alter table meta_ads_daily
  add constraint meta_ads_daily_date_ad_id_key unique (date, ad_id);
