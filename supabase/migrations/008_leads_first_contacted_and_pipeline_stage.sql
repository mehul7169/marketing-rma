-- Lead lifecycle data model (Prompt 2). Applied to production manually on 2026-10-27.
-- Idempotent: safe to re-run.

-- a. Contacted milestone: set once on the first call attempt, never cleared.
--    contact_attempts stays the cadence counter (it resets intentionally).
alter table leads add column if not exists first_contacted_at timestamptz;

update leads l set first_contacted_at = a.first_at
from (
  select lead_id, min(created_at) first_at
  from lead_activities
  where type = 'call_attempt'
  group by lead_id
) a
where a.lead_id = l.id and l.first_contacted_at is null;  -- 559 rows on 2026-10-27

-- b. A no-show must not carry call_showed_at (it inflated showups-by-date).
update leads set call_showed_at = null
where call_showed is false and call_showed_at is not null;  -- 4 rows on 2026-10-27

-- c. Pre-call pipeline stage, computed by Postgres so it can't drift.
--    App code must never write it (428C9); see omitGeneratedLeadColumns.
--    Dead is an overlay (is_dead), not a pipeline stage.
alter table leads add column if not exists pipeline_stage text generated always as (
  case
    when call_showed is true            then 'showed_up'
    when call_booked_at is not null     then 'call_booked'
    when qualified is true              then 'qualified'
    when first_contacted_at is not null then 'contacted'
    else 'new'
  end
) stored;

create index if not exists leads_org_pipeline_stage_idx on leads (org_id, pipeline_stage);
create index if not exists leads_org_next_action_idx on leads (org_id, next_action_at);
