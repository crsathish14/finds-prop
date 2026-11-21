-- F04 follow-up: the project form change (ADR-148), step one of two. This step only adds: new columns,
-- a wider list of property types, grants for the new columns, and the conversion of the rows already
-- there. Nothing the running app writes or reads stops working: the old columns (price_min, price_max)
-- and the old project type value (plotted_layout) stay until the closing step (S-PF-D), once the
-- screens read the new columns.
--
-- What the owner asked for (21 Nov 2026):
--   * a project is residential or commercial; a plotted layout is a residential project of plots;
--   * property type: apartment, villa, plot (residential); vacant land, flat, office, co-working
--     space, villa (commercial);
--   * a commercial project is for sale or for rent (offer_type);
--   * one price with a price type (rate per sq ft, basic price, all inclusive; for rent, rent per
--     month or rent per sq ft per month), instead of a lowest and a highest price;
--   * a plot and every commercial type give a smallest and a largest area in square feet;
--   * a project that is not under RERA says why (public, like the RERA number).
-- The rules that tie the columns together (what is required, which property types go with which
-- project type, BHK only for apartments and villas) are added by the closing step, after every row
-- has been converted here and the form sends the new fields.
--
-- Rollback note: nothing is dropped. The converted rows keep their old price columns. To go back,
-- fix forward with a new migration (plotted layouts are the rows with property_type = 'plot').

alter table public.projects
  add column offer_type text,
  add column price bigint,
  add column price_type text,
  add column area_min_sqft numeric(10, 2),
  add column area_max_sqft numeric(10, 2),
  add column rera_not_applicable_reason text,
  add constraint projects_offer_type check (offer_type in ('sale', 'rent')),
  add constraint projects_price_positive check (price > 0),
  add constraint projects_price_type
    check (price_type in ('per_sqft', 'basic', 'all_inclusive', 'rent_per_month', 'rent_per_sqft_month')),
  -- A rent price type goes with a project for rent, a sale price type with any other.
  add constraint projects_price_type_offer check (
    price_type is null
    or (price_type in ('rent_per_month', 'rent_per_sqft_month') and coalesce(offer_type = 'rent', false))
    or (price_type in ('per_sqft', 'basic', 'all_inclusive') and offer_type is distinct from 'rent')
  ),
  add constraint projects_area_min_positive check (area_min_sqft > 0),
  add constraint projects_area_max_positive check (area_max_sqft > 0),
  add constraint projects_area_range check (area_min_sqft is null or area_max_sqft is null or area_min_sqft <= area_max_sqft),
  add constraint projects_area_together check ((area_min_sqft is null) = (area_max_sqft is null)),
  add constraint projects_rera_reason_length
    check (char_length(btrim(rera_not_applicable_reason)) between 1 and 300);

-- The new property types. The project type list keeps plotted_layout until the closing step.
alter table public.projects drop constraint projects_property_type_check;
alter table public.projects add constraint projects_property_type_check
  check (property_type in ('apartment', 'villa', 'plot', 'vacant_land', 'flat', 'office', 'co_working'));

-- Conversion of the rows already there. The migration runs as the system, so the guard trigger does
-- not send these projects back to review. Production has no projects (owner, 21 Nov 2026); the rows
-- on dev are fictional or test rows, so a value that was never given gets a plain placeholder.

-- A plotted layout is a residential project of plots.
update public.projects
set project_type = 'residential', property_type = 'plot'
where project_type = 'plotted_layout';

-- A project that never named a property type: apartments for residential, offices for commercial.
update public.projects
set property_type = case when project_type = 'commercial' then 'office' else 'apartment' end
where property_type is null;

-- Every commercial project that exists is for sale.
update public.projects set offer_type = 'sale' where project_type = 'commercial';

-- One price: the old lowest price, as a basic price. A row that never had a price takes its cheapest
-- unit, or a placeholder.
update public.projects as project
set
  price = coalesce(
    nullif(project.price_min, 0),
    nullif(project.price_max, 0),
    (select min(unit.price) from public.project_units as unit where unit.project_id = project.id and unit.price > 0),
    1000000
  ),
  price_type = 'basic'
where project.price is null;

-- Plots and commercial projects: the size range comes from the units, or a placeholder.
update public.projects as project
set area_min_sqft = coalesce(sizes.low, 1000), area_max_sqft = coalesce(sizes.high, 2000)
from (
  select candidate.id, min(unit.area_sqft) as low, max(unit.area_sqft) as high
  from public.projects as candidate
  left join public.project_units as unit on unit.project_id = candidate.id and unit.area_sqft > 0
  group by candidate.id
) as sizes
where sizes.id = project.id
  and (project.property_type = 'plot' or project.project_type = 'commercial');

-- Possession is a month: the first day of it. A project still to be built and with no date gets a
-- date a year from now.
update public.projects
set possession_date = date_trunc('month', possession_date)::date
where possession_date is not null;

update public.projects
set possession_date = date_trunc('month', current_date + interval '12 months')::date
where project_status in ('new_launch', 'under_construction') and possession_date is null;

-- RERA: a project under RERA has a number, one that is not says why. A project marked as under RERA
-- without a number is marked as not under it (the number cannot be invented).
update public.projects
set rera_applicable = false, rera_number = null
where rera_applicable and (rera_number is null or btrim(rera_number) = '');

update public.projects
set rera_not_applicable_reason = 'The developer has not given a reason yet.'
where not rera_applicable and rera_not_applicable_reason is null;

-- Grants. The new columns are public, like the RERA number (the reason is shown on the project
-- page, ADR-148), and the builder and the admin write them.
grant select (
  offer_type, price, price_type, area_min_sqft, area_max_sqft, rera_not_applicable_reason
) on table public.projects to anon, authenticated;
grant insert (
  offer_type, price, price_type, area_min_sqft, area_max_sqft, rera_not_applicable_reason
) on table public.projects to authenticated;
grant update (
  offer_type, price, price_type, area_min_sqft, area_max_sqft, rera_not_applicable_reason
) on table public.projects to authenticated;
