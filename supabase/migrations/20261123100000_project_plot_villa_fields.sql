-- F04 follow-up: two more boxes on the project form (ADR-160), owner's change request of 22 Nov 2026.
--   * a plot says whether it is an investment plot or ready to build (plot_status);
--   * a villa says whether it is a duplex, a row house or an individual villa (villa_type).
-- Only adds: two nullable columns, null-tolerant checks that tie each to its property type, column grants, and a
-- wider form guard. Nothing is dropped and no row is rewritten: the projects already there keep a blank value
-- (nobody can say which kind of plot or villa they are), they show nothing until their builder edits and
-- picks one, which the guard then asks for (a project saved without touching the form's boxes is not asked).
--
-- Rollback note: fix forward. Dropping the columns loses only these two choices.

alter table public.projects
  add column plot_status text,
  add column villa_type text,
  add constraint projects_plot_status check (plot_status in ('investment', 'ready_to_build')),
  add constraint projects_villa_type check (villa_type in ('duplex', 'row_house', 'individual')),
  add constraint projects_plot_status_for_plot check (plot_status is null or property_type = 'plot'),
  add constraint projects_villa_type_for_villa check (villa_type is null or property_type = 'villa');

-- Public, like the other facts of the project page; written by the builder and the admin.
grant select (plot_status, villa_type) on table public.projects to anon, authenticated;
grant insert (plot_status, villa_type) on table public.projects to authenticated;
grant update (plot_status, villa_type) on table public.projects to authenticated;

-- The form guard of the closing migration, with the two new choices: a plot needs its status and a villa its type
-- when a builder or the admin saves the form's boxes. The system stays exempt.
create or replace function public.guard_project_form()
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
  if tg_op = 'UPDATE' and (
    new.project_type, new.property_type, new.offer_type, new.project_status, new.price, new.price_type,
    new.area_min_sqft, new.area_max_sqft, new.possession_date, new.rera_applicable, new.rera_number,
    new.rera_not_applicable_reason, new.plot_status, new.villa_type
  ) is not distinct from (
    old.project_type, old.property_type, old.offer_type, old.project_status, old.price, old.price_type,
    old.area_min_sqft, old.area_max_sqft, old.possession_date, old.rera_applicable, old.rera_number,
    old.rera_not_applicable_reason, old.plot_status, old.villa_type
  ) then
    return new;
  end if;
  if new.project_type is null or new.property_type is null or new.project_status is null
     or new.price is null or new.price_type is null then
    raise exception 'projects.form_incomplete' using errcode = '23514';
  end if;
  if new.property_type = 'plot' and new.plot_status is null then
    raise exception 'projects.plot_status_required' using errcode = '23514';
  end if;
  if new.property_type = 'villa' and new.villa_type is null then
    raise exception 'projects.villa_type_required' using errcode = '23514';
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
