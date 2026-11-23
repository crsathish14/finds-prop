-- destructive: drops projects.price_min and projects.price_max, which the one price (projects.price) replaces; production has no projects
-- F04 follow-up: the project form change (ADR-148), step two of two (contract). The form, the pages and the
-- assistant now read and write the new columns (#295, #296, #297), so this step closes what the first step left
-- open: the rules that tie the columns together become database rules, the old project type value and the old
-- price columns go, and the admin's overview function returns the one price.
--
-- The rules (owner, 21 Nov 2026):
--   * a project is residential or commercial; its property type goes with it (residential: apartment, villa,
--     plot; commercial: vacant land, flat, office, co-working space, villa);
--   * a commercial project is for sale or rent, a residential one is not (`offer_type`);
--   * bedrooms only for a residential apartment or villa;
--   * a plot and every commercial project give an area range, no other project does;
--   * possession is a month: given while the project is a new launch or under construction, none for a ready one;
--   * the reason RERA does not apply is only given when RERA does not apply (a number only when it does: the
--     first migration's check);
--   * the project type, property type, status, price and price type are required, and so is the RERA number when
--     RERA applies and the reason when it does not.
-- The checks hold for every writer and let a missing value through (a row written by the system before a value
-- is known, as the seed and the tests do). The "is required" rules are a trigger for the people who write
-- through the portal (a builder, the admin), as the guard of the first migration is: the system (this migration,
-- the seed, the service role and the moderation functions) is exempt, so approving a project never fails on a
-- form rule. An edit that changes none of the form's columns (a moderator's, or one of the units) is not asked
-- for the whole form again.
--
-- Rollback note: the old price columns are dropped, which cannot be undone. Their values live on in `price` (a
-- range was kept as its lowest price when the first migration ran). To go back, add the columns in a new
-- migration and fill them from `price`.

-- 1. The rows written since the first migration, converted as it did.
update public.projects set project_type = 'residential' where project_type is null;
update public.projects
set project_type = 'residential', property_type = 'plot'
where project_type = 'plotted_layout';
update public.projects
set property_type = case when project_type = 'commercial' then 'office' else 'apartment' end
where property_type is null;
update public.projects
set property_type = 'apartment'
where project_type = 'residential' and property_type in ('vacant_land', 'flat', 'office', 'co_working');
update public.projects
set property_type = 'office'
where project_type = 'commercial' and property_type in ('apartment', 'plot');

update public.projects set offer_type = 'sale' where project_type = 'commercial' and offer_type is null;
update public.projects
set offer_type = null,
    price_type = case when price_type in ('rent_per_month', 'rent_per_sqft_month') then 'basic' else price_type end
where project_type = 'residential' and offer_type is not null;

update public.projects as project
set price = coalesce(
  nullif(project.price_min, 0),
  nullif(project.price_max, 0),
  (select min(unit.price) from public.project_units as unit where unit.project_id = project.id and unit.price > 0),
  1000000
)
where project.price is null;
update public.projects
set price_type = case when offer_type = 'rent' then 'rent_per_month' else 'basic' end
where price_type is null;
update public.projects
set price_type = 'rent_per_month'
where offer_type = 'rent' and price_type not in ('rent_per_month', 'rent_per_sqft_month');
update public.projects
set price_type = 'basic'
where offer_type is distinct from 'rent' and price_type in ('rent_per_month', 'rent_per_sqft_month');

update public.projects set project_status = 'ready_to_move' where project_status is null;

update public.projects as project
set area_min_sqft = coalesce(sizes.low, 1000), area_max_sqft = coalesce(sizes.high, 2000)
from (
  select candidate.id, min(unit.area_sqft) as low, max(unit.area_sqft) as high
  from public.projects as candidate
  left join public.project_units as unit on unit.project_id = candidate.id and unit.area_sqft > 0
  group by candidate.id
) as sizes
where sizes.id = project.id
  and (project.property_type = 'plot' or project.project_type = 'commercial')
  and project.area_min_sqft is null;
update public.projects
set area_min_sqft = null, area_max_sqft = null
where not (property_type = 'plot' or project_type = 'commercial')
  and (area_min_sqft is not null or area_max_sqft is not null);

update public.projects
set bhk_options = '{}'
where cardinality(bhk_options) > 0
  and not (project_type = 'residential' and property_type in ('apartment', 'villa'));

update public.projects
set possession_date = date_trunc('month', possession_date)::date
where possession_date is not null and extract(day from possession_date) <> 1;
update public.projects
set possession_date = date_trunc('month', current_date + interval '12 months')::date
where project_status in ('new_launch', 'under_construction') and possession_date is null;
update public.projects
set possession_date = null
where project_status = 'ready_to_move' and possession_date is not null;

update public.projects
set rera_applicable = false, rera_number = null
where rera_applicable and (rera_number is null or btrim(rera_number) = '');
update public.projects
set rera_not_applicable_reason = 'The developer has not given a reason yet.'
where not rera_applicable and rera_not_applicable_reason is null;
update public.projects
set rera_not_applicable_reason = null
where rera_applicable and rera_not_applicable_reason is not null;

-- 2. The rules between the columns, for every writer. A missing value passes: the checks say what must hold when
-- the values are there.
alter table public.projects
  drop constraint projects_project_type_check,
  add constraint projects_project_type_check check (project_type in ('residential', 'commercial')),
  add constraint projects_property_type_fits check (
    project_type is null
    or property_type is null
    or (project_type = 'residential' and property_type in ('apartment', 'villa', 'plot'))
    or (project_type = 'commercial'
        and property_type in ('vacant_land', 'flat', 'office', 'co_working', 'villa'))
  ),
  add constraint projects_offer_type_commercial check (
    project_type is null or (project_type = 'commercial') = (offer_type is not null)
  ),
  add constraint projects_bhk_for_kind check (
    cardinality(bhk_options) = 0
    or project_type is null
    or property_type is null
    or (project_type = 'residential' and property_type in ('apartment', 'villa'))
  ),
  add constraint projects_area_for_kind check (
    project_type is null
    or property_type is null
    or (property_type = 'plot' or project_type = 'commercial') = (area_min_sqft is not null)
  ),
  add constraint projects_possession_for_status check (
    project_status is null or (project_status = 'ready_to_move') = (possession_date is null)
  ),
  add constraint projects_possession_month check (
    possession_date is null or extract(day from possession_date) = 1
  ),
  add constraint projects_rera_reason_only check (
    rera_not_applicable_reason is null or not rera_applicable
  );

-- 3. What the people who write through the portal must give. The system is exempt (see the top of this file), and
-- so is anyone who is neither a builder nor the admin (the row-level rules refuse them with a permission error).
create function public.guard_project_form()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_system constant boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if is_system then
    return new;
  end if;
  if not ((select public.is_super_admin()) or (select public.current_builder_id()) is not null) then
    return new;
  end if;
  -- An edit that leaves the form's own columns as they were is not asked for the whole form again.
  if tg_op = 'UPDATE' and (
    new.project_type, new.property_type, new.offer_type, new.project_status, new.price, new.price_type,
    new.area_min_sqft, new.area_max_sqft, new.possession_date, new.rera_applicable, new.rera_number,
    new.rera_not_applicable_reason
  ) is not distinct from (
    old.project_type, old.property_type, old.offer_type, old.project_status, old.price, old.price_type,
    old.area_min_sqft, old.area_max_sqft, old.possession_date, old.rera_applicable, old.rera_number,
    old.rera_not_applicable_reason
  ) then
    return new;
  end if;
  if new.project_type is null or new.property_type is null or new.project_status is null
     or new.price is null or new.price_type is null then
    raise exception 'projects.form_incomplete' using errcode = '23514';
  end if;
  if new.rera_applicable then
    if new.rera_number is null or btrim(new.rera_number) = '' then
      raise exception 'projects.rera_number_required' using errcode = '23514';
    end if;
  elsif new.rera_not_applicable_reason is null then
    raise exception 'projects.rera_reason_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- The name sorts after `projects_guard`, so the first migration's guard speaks first (a builder who names another
-- builder is told so, not that the form is incomplete).
create trigger projects_guard_form
  before insert or update on public.projects
  for each row execute function public.guard_project_form();

revoke execute on function public.guard_project_form() from public, anon, authenticated;

-- 4. The admin's overview returns the one price and what it means in place of the lowest and highest price.
drop function public.admin_project_overview();

create function public.admin_project_overview()
returns table (
  id uuid,
  name text,
  slug text,
  locality text,
  price bigint,
  price_type text,
  cover text,
  moderation text,
  published boolean,
  featured boolean,
  builder_id uuid,
  builder_name text,
  leads bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'project.not_allowed' using errcode = '42501';
  end if;
  return query
  select
    project.id,
    project.name,
    project.slug,
    project.locality,
    project.price,
    project.price_type,
    project.images[1],
    project.moderation,
    project.published,
    project.featured,
    project.builder_id,
    builder.name,
    (select count(*) from public.project_leads as lead where lead.project_id = project.id),
    project.created_at
  from public.projects as project
  join public.builders as builder on builder.id = project.builder_id
  order by project.created_at desc, project.id;
end;
$$;

revoke execute on function public.admin_project_overview() from public, anon, authenticated;
grant execute on function public.admin_project_overview() to authenticated, service_role;

-- 5. The old price columns, and the check that kept them in order.
alter table public.projects
  drop constraint projects_price_range,
  drop column price_min,
  drop column price_max;
