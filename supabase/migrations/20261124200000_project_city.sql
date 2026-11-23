-- Header city selector, part 3: projects get a city.
-- Why: the header city also filters projects (the projects list and the homepage "New launches"). A project
-- had only a locality, so the city is new.
--   1. projects.city: text, 2 to 80 characters, public like the locality, written by the builder and the admin
--      through the existing project grants. Existing rows are filled with 'Chennai' (every project today is in
--      the Chennai region, and Chennai is the site's default city); the default stays so an insert from code
--      that does not know the column yet is not refused. The project form asks for the city (part 4).
--   2. A trigger adds the city (only the city, never the locality) to the cities table when a project is
--      written, like the one on properties. The cities of the existing projects are added now.
--   3. listed_cities() now counts approved homes AND live projects (approved, published, active builder), and
--      runs with the owner's rights with those rules written out, so it does not depend on what a visitor can
--      read of the tables (the login wall closes the project table to visitors).
--   4. live_project_list() and home_developers() take an optional city key (default null = every city).
--      Each is dropped and made again because its argument list changes; results and grants are unchanged.
-- Rollback note: nothing stored is lost. To go back, add a migration that drops the trigger, the index and the
-- column, and makes listed_cities(), live_project_list() and home_developers() again from their earlier files
-- (20261124120000_cities.sql, 20261123190000_login_wall_project_list.sql, 20261123180000_public_detail_functions.sql).

alter table public.projects
  add column city text not null default 'Chennai' check (char_length(btrim(city)) between 2 and 80);

grant select (city) on table public.projects to anon, authenticated;
grant insert (city) on table public.projects to authenticated;
grant update (city) on table public.projects to authenticated;

create index projects_city_key_idx on public.projects (public.city_key(city));

create function public.add_project_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.city_key(new.city) is not null then
    insert into public.cities (key, name)
    values (public.city_key(new.city), public.city_display_name(new.city))
    on conflict (key) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.add_project_city() from public, anon, authenticated;

create trigger projects_add_city
  after insert or update of city on public.projects
  for each row execute function public.add_project_city();

insert into public.cities (key, name)
select distinct on (public.city_key(city)) public.city_key(city), public.city_display_name(city)
from public.projects
where public.city_key(city) is not null
order by public.city_key(city), created_at desc
on conflict (key) do nothing;

-- The cities that have at least one approved home or live project, most listings first.
create or replace function public.listed_cities()
returns table (key text, name text, listing_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select cities.key, cities.name, count(*) as listing_count
  from public.cities as cities
  join (
    select public.city_key(home.city) as city_key
    from public.properties as home
    where home.status = 'approved'
    union all
    select public.city_key(project.city)
    from public.projects as project
    join public.builders as builder on builder.id = project.builder_id and builder.active
    where project.moderation = 'approved' and project.published
  ) as listed on listed.city_key = cities.key
  group by cities.key, cities.name
  order by count(*) desc, cities.name
$$;

-- The projects list for signed-in visitors, of one city when a key is given.
drop function public.live_project_list(integer);

create function public.live_project_list(p_limit integer default 60, p_city text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', live.slug, 'name', live.name, 'project_status', live.project_status,
        'offer_type', live.offer_type, 'price', live.price, 'price_type', live.price_type,
        'bhk_options', live.bhk_options, 'locality', live.locality, 'city', live.city, 'images', live.images,
        'featured', live.featured,
        'builders', jsonb_build_object('id', live.builder_id, 'name', live.builder_name)
      )
      order by live.featured desc, live.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select project.slug, project.name, project.project_status, project.offer_type, project.price,
      project.price_type, project.bhk_options, project.locality, project.city, project.images, project.featured,
      project.created_at, project.builder_id, builder.name as builder_name
    from public.projects as project
    join public.builders as builder on builder.id = project.builder_id and builder.active
    where project.moderation = 'approved' and project.published
      and (public.city_key(p_city) is null or public.city_key(project.city) = public.city_key(p_city))
    order by project.featured desc, project.created_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 120)
  ) as live
$$;

revoke execute on function public.live_project_list(integer, text) from public, anon;
grant execute on function public.live_project_list(integer, text) to authenticated, service_role;

-- The live projects that rank the homepage developers, of one city when a key is given.
drop function public.home_developers();

create function public.home_developers(p_city text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', ranked.slug, 'name', ranked.name, 'builder_id', ranked.builder_id, 'images', ranked.images,
        'builders', jsonb_build_object('id', ranked.builder_id, 'name', ranked.builder_name,
          'description', ranked.builder_description)
      )
      order by ranked.featured desc, ranked.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select project.slug, project.name, project.builder_id, project.images[1:1] as images, project.featured,
      project.created_at, builder.name as builder_name, builder.description as builder_description
    from public.projects as project
    join public.builders as builder on builder.id = project.builder_id and builder.active
    where project.moderation = 'approved' and project.published
      and (public.city_key(p_city) is null or public.city_key(project.city) = public.city_key(p_city))
    order by project.featured desc, project.created_at desc
    limit 1000
  ) as ranked
$$;

revoke execute on function public.home_developers(text) from public;
grant execute on function public.home_developers(text) to anon, authenticated, service_role;
