-- F04 follow-up: save a project's price trends in one step (S7-T02, FR-ADM-03).
-- The project form shows "Price trends": a list of months with the price per square foot. The admin edits the whole
-- list and saves it with the project, so the table must follow the list: the months that were removed go, the
-- others are added or changed. Doing that from the application would be several writes that can stop half way; one
-- function does it as one change. It is for the super admin only and checks that itself, so a mistake in a grant
-- cannot open it. The table's own checks still hold (a month is the first of a month, a price is 1 to 10 million).
-- Rollback note: nothing here is destructive. Drop the function, or fix forward with a new migration.

create function public.save_project_price_trends(p_project uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored integer;
begin
  if not (select public.is_super_admin()) then
    raise exception 'project_price_trends.not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 120 then
    raise exception 'project_price_trends.invalid_rows' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as entry
    where jsonb_typeof(entry) is distinct from 'object'
      or entry ->> 'month' is null
      or entry ->> 'price_per_sqft' is null
  ) then
    raise exception 'project_price_trends.invalid_rows' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct entry ->> 'month') from jsonb_array_elements(p_rows) as entry
  ) then
    raise exception 'project_price_trends.duplicate_month' using errcode = '23505';
  end if;
  if not exists (select 1 from public.projects where id = p_project) then
    raise exception 'project_price_trends.no_project' using errcode = '23503';
  end if;

  delete from public.project_price_trends
  where project_id = p_project
    and month not in (select (entry ->> 'month')::date from jsonb_array_elements(p_rows) as entry);

  insert into public.project_price_trends (project_id, month, price_per_sqft)
  select p_project, (entry ->> 'month')::date, (entry ->> 'price_per_sqft')::integer
  from jsonb_array_elements(p_rows) as entry
  on conflict (project_id, month) do update set price_per_sqft = excluded.price_per_sqft;

  select count(*) into stored from public.project_price_trends where project_id = p_project;
  return stored;
end;
$$;

revoke execute on function public.save_project_price_trends(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_project_price_trends(uuid, jsonb) to authenticated, service_role;
