-- Atomic lead write + activity log (Prompt 2 single write path).
-- Updates only the columns present in p_patch, then inserts p_activities, in one
-- transaction: a failed activity insert rolls back the lead update and vice versa.
-- Called by the app with the service role only.

create or replace function apply_lead_change(
  p_lead_id uuid,
  p_org_id uuid,
  p_patch jsonb,
  p_activities jsonb default '[]'::jsonb
) returns setof leads
language plpgsql
set search_path = public
as $$
declare
  v_cols text;
  v_vals text;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'p_patch must be a json object';
  end if;
  if p_patch ?| array['id', 'org_id', 'created_at', 'pipeline_stage'] then
    raise exception 'p_patch may not set id, org_id, created_at or pipeline_stage';
  end if;

  select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', ')
    into v_cols, v_vals
  from jsonb_object_keys(p_patch) as k;

  if v_cols is not null then
    execute format(
      'update leads l set (%s) = (select %s from jsonb_populate_record(null::leads, $1) r)
       where l.id = $2 and l.org_id = $3',
      v_cols, v_vals
    ) using p_patch, p_lead_id, p_org_id;
  end if;

  if not exists (select 1 from leads where id = p_lead_id and org_id = p_org_id) then
    raise exception 'Lead % not found in org %', p_lead_id, p_org_id;
  end if;

  insert into lead_activities (org_id, lead_id, type, outcome, note, next_action_at, created_by)
  select p_org_id, p_lead_id, a.type, a.outcome, nullif(btrim(a.note), ''), a.next_action_at, a.created_by
  from jsonb_to_recordset(coalesce(p_activities, '[]'::jsonb))
    as a(type text, outcome text, note text, next_action_at timestamptz, created_by uuid);

  return query select * from leads where id = p_lead_id and org_id = p_org_id;
end;
$$;

-- Not callable from the browser (anon / authenticated); service role only.
revoke all on function apply_lead_change(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function apply_lead_change(uuid, uuid, jsonb, jsonb) to service_role;
