-- Form Qualified split: move the form's answer out of `qualified` into `form_qualified`.
-- Counts below are from the live DB at time of writing.
--
-- PHASE A is additive and safe to run any time.
-- PHASE B changes what `qualified` means. Run it in the SAME deploy as the code change
-- (ingestion writes form answers to `form_qualified`; Meta Ads "qualified opt-ins" reads
-- `form_qualified`), otherwise new leads keep writing the form answer into `qualified`.
 
-- ============================================================
-- PHASE A: add column + copy form answers (safe now)
-- ============================================================
alter table leads add column if not exists form_qualified boolean;
 
update leads
set form_qualified = qualified
where qualified_by = 'form';          -- expect 480 rows
 
-- ============================================================
-- PREVIEW: what Phase B will do (read-only, run first)
-- Expect: 102 rows with setter evidence, 378 reset to NULL.
-- ============================================================
with ev as (
  select distinct on (a.lead_id)
    a.lead_id,
    case when a.outcome in ('qualified','verified') then true
         when a.outcome in ('not_qualified','unqualified') then false end as setter_q,
    a.created_at as decided_at,
    p.email as decided_by
  from lead_activities a
  left join profiles p on p.id = a.created_by
  where (a.type = 'call_attempt' and a.outcome in ('qualified','not_qualified'))
     or (a.type in ('setter_verification','qualification')
         and a.outcome in ('verified','qualified','unqualified'))
  order by a.lead_id, a.created_at desc
)
select l.form_qualified, ev.setter_q as new_qualified, count(*)
from leads l
left join ev on ev.lead_id = l.id
where l.qualified_by = 'form'
group by 1, 2
order by 1, 2;
 
-- ============================================================
-- PHASE B: set `qualified` to the setter's decision only
-- (run with the code deploy, inside a transaction)
-- ============================================================
begin;
 
with ev as (
  select distinct on (a.lead_id)
    a.lead_id,
    case when a.outcome in ('qualified','verified') then true
         when a.outcome in ('not_qualified','unqualified') then false end as setter_q,
    a.created_at as decided_at,
    p.email as decided_by
  from lead_activities a
  left join profiles p on p.id = a.created_by
  where (a.type = 'call_attempt' and a.outcome in ('qualified','not_qualified'))
     or (a.type in ('setter_verification','qualification')
         and a.outcome in ('verified','qualified','unqualified'))
  order by a.lead_id, a.created_at desc
)
update leads l
set qualified    = ev.setter_q,
    qualified_at = ev.decided_at,
    qualified_by = ev.decided_by
from leads l2
left join ev on ev.lead_id = l2.id
where l.id = l2.id
  and l2.qualified_by = 'form';       -- expect 480 rows updated
 
-- Sanity check before commit: no rows should still say qualified_by = 'form'
select count(*) as still_form from leads where qualified_by = 'form';        -- expect 0
select form_qualified, qualified, count(*) from leads
where form_qualified is not null group by 1, 2 order by 1, 2;
 
commit;   -- or rollback if the numbers look off
 
-- Not touched on purpose:
-- * qualified_by IS NULL (221 quickform leads) and qualified_by = <email> (30): already setter decisions.
-- * is_dead / lifecycle_status: no backfill. "Unqualified -> Dead" applies going forward only.
 