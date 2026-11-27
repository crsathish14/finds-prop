-- Rollback for 20261128090000_residential_project_rent.sql (ADR-214). Reviewed, never run automatically: a person
-- runs it, by hand, against the project that needs it, after the app no longer offers rent for a residential project.
--
-- It refuses to run while any residential project is for rent, because the old check would reject that row: change
-- those projects first. The two amounts are dropped with their values (they mean nothing for a project for sale).

do $$
begin
  if exists (select 1 from public.projects where project_type = 'residential' and offer_type = 'rent') then
    raise exception 'residential projects for rent exist: change them before rolling back';
  end if;
end;
$$;

update public.projects set offer_type = null where project_type = 'residential' and offer_type = 'sale';

alter table public.projects
  drop constraint projects_residential_rent_per_month,
  drop constraint projects_offer_type_fits,
  add constraint projects_offer_type_commercial check (
    project_type is null or (project_type = 'commercial') = (offer_type is not null)
  ),
  drop constraint projects_rent_amounts_for_rent,
  drop constraint projects_maintenance_positive,
  drop constraint projects_security_deposit_positive,
  drop column maintenance_per_month,
  drop column security_deposit;

-- guard_project_form() and public_project() go back by running the bodies of 20261123100000 and 20261124220000 again.
