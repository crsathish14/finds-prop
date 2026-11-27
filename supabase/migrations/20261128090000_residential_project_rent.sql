-- F04 follow-up: a residential project may be for rent (owner, 27 Nov 2026; ADR-214, which changes ADR-148's
-- "a residential project is not for rent").
--   * a residential project is for sale (offer_type empty or 'sale') or for rent ('rent'), never both;
--   * a residential project for rent is priced per month only (price_type 'rent_per_month');
--   * a project for rent may give a security deposit and a maintenance amount per month, in whole rupees; a
--     project for sale gives neither.
-- Only adds and widens: two nullable columns, their checks and grants, a wider check in place of
-- projects_offer_type_commercial, the form guard with the two new columns, and public_project() with two more keys.
-- No row is rewritten: every residential project stays for sale.
--
-- Rollback note: supabase/rollbacks/20261128090000.sql (reviewed, never run automatically). It refuses to run
-- while a residential project is for rent, because the old check would fail on it.

alter table public.projects
  add column security_deposit bigint,
  add column maintenance_per_month bigint,
  add constraint projects_security_deposit_positive check (security_deposit is null or security_deposit > 0),
  add constraint projects_maintenance_positive check (maintenance_per_month is null or maintenance_per_month > 0),
  add constraint projects_rent_amounts_for_rent check (
    -- 'is not distinct from', so an empty offer type (a residential project for sale) is refused too, not let through as unknown.
    (security_deposit is null and maintenance_per_month is null) or offer_type is not distinct from 'rent'
  );

-- A commercial project still says sale or rent; a residential one may now say rent (empty or sale is for sale).
alter table public.projects
  drop constraint projects_offer_type_commercial,
  add constraint projects_offer_type_fits check (
    project_type is distinct from 'commercial' or offer_type is not null
  ),
  add constraint projects_residential_rent_per_month check (
    project_type is distinct from 'residential'
    or offer_type is distinct from 'rent'
    or price_type is null
    or price_type = 'rent_per_month'
  );

-- Read by signed-in visitors like the price of the project page (the login wall, ADR-171: no project column for anon);
-- written by the builder and the admin.
grant select (security_deposit, maintenance_per_month) on table public.projects to authenticated;
grant insert (security_deposit, maintenance_per_month) on table public.projects to authenticated;
grant update (security_deposit, maintenance_per_month) on table public.projects to authenticated;

-- The form guard of 20261123100000, with the two new columns among the form's own: an edit that changes only them
-- is a form edit too. The rules it asks for are unchanged. The system stays exempt.
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
    new.rera_not_applicable_reason, new.plot_status, new.villa_type, new.security_deposit,
    new.maintenance_per_month
  ) is not distinct from (
    old.project_type, old.property_type, old.offer_type, old.project_status, old.price, old.price_type,
    old.area_min_sqft, old.area_max_sqft, old.possession_date, old.rera_applicable, old.rera_number,
    old.rera_not_applicable_reason, old.plot_status, old.villa_type, old.security_deposit,
    old.maintenance_per_month
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

-- The project page's read (20261124220000) with the two amounts.
create or replace function public.public_project(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', project.id, 'slug', project.slug, 'name', project.name,
      'project_status', project.project_status, 'property_type', project.property_type,
      'plot_status', project.plot_status, 'villa_type', project.villa_type,
      'extra_fields', project.extra_fields,
      'offer_type', project.offer_type, 'price', project.price, 'price_type', project.price_type,
      'security_deposit', project.security_deposit, 'maintenance_per_month', project.maintenance_per_month,
      'area_min_sqft', project.area_min_sqft, 'area_max_sqft', project.area_max_sqft,
      'bhk_options', project.bhk_options, 'land_area_acres', project.land_area_acres,
      'total_units', project.total_units, 'possession_date', project.possession_date,
      'contact_phone', project.contact_phone, 'locality', project.locality,
      'advantages', project.advantages, 'nearby', project.nearby,
      'rera_applicable', project.rera_applicable, 'rera_number', project.rera_number,
      'rera_not_applicable_reason', project.rera_not_applicable_reason,
      'description', project.description, 'specifications', project.specifications,
      'amenities', project.amenities, 'images', project.images, 'floor_plans', project.floor_plans,
      'videos', project.videos, 'brochure_path', project.brochure_path,
      'seo_title', project.seo_title, 'seo_description', project.seo_description,
      'featured', project.featured,
      'builders', jsonb_build_object('id', builder.id, 'name', builder.name)
    ),
    'units', coalesce((
      select jsonb_agg(to_jsonb(shown) order by shown.floor_number nulls last, shown.unit_number)
      from (
        select unit.unit_number, unit.floor_number, unit.bhk, unit.area_sqft, unit.facing, unit.price,
          unit.status, unit.floor_plan_path
        from public.project_units as unit
        where unit.project_id = project.id
        order by unit.floor_number nulls last, unit.unit_number
        limit 20
      ) as shown
    ), '[]'::jsonb),
    'unit_count', (select count(*) from public.project_units as unit where unit.project_id = project.id),
    'available_count', (
      select count(*) from public.project_units as unit
      where unit.project_id = project.id and unit.status = 'available'
    ),
    'trend', coalesce((
      select jsonb_agg(to_jsonb(latest) order by latest.month desc)
      from (
        select trend.month, trend.price_per_sqft
        from public.project_price_trends as trend
        where trend.project_id = project.id
        order by trend.month desc
        limit 12
      ) as latest
    ), '[]'::jsonb)
  )
  from public.projects as project
  join public.builders as builder on builder.id = project.builder_id and builder.active
  where project.slug = p_slug and project.moderation = 'approved' and project.published
$$;

revoke execute on function public.public_project(text) from public;
grant execute on function public.public_project(text) to anon, authenticated, service_role;
