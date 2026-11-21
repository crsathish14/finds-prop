-- Rollback for 20261122110000_project_form_contract.sql (ADR-148). Reviewed, never run automatically: a person
-- runs it, by hand, against the project that needs it, and then removes the migration's effect from the app (the
-- form and the pages read `price`, not these columns).
--
-- What it brings back: the lowest and highest price columns and the check that kept them in order, the old
-- project type value, and the admin overview that returned them. What it cannot bring back: a range of prices.
-- Both columns are filled from the one price, which is what the first migration kept of a range (its lowest).
-- It does not undo the rules between the columns (they are compatible with the old shape) or the conversion of
-- the rows (a plotted layout stays a residential plot).

alter table public.projects
  add column price_min bigint check (price_min >= 0),
  add column price_max bigint check (price_max >= 0);

update public.projects set price_min = price, price_max = price;

alter table public.projects
  add constraint projects_price_range check (price_min is null or price_max is null or price_min <= price_max);

alter table public.projects drop constraint projects_project_type_check;
alter table public.projects add constraint projects_project_type_check
  check (project_type in ('residential', 'commercial', 'plotted_layout'));

grant select (price_min, price_max) on table public.projects to anon, authenticated;
grant insert (price_min, price_max) on table public.projects to authenticated;
grant update (price_min, price_max) on table public.projects to authenticated;

drop function public.admin_project_overview();

create function public.admin_project_overview()
returns table (
  id uuid,
  name text,
  slug text,
  locality text,
  price_min bigint,
  price_max bigint,
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
    project.price_min,
    project.price_max,
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
