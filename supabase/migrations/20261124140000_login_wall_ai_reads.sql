-- Login wall, AI tools change: the two reads the assistant's list tools still made on the tables.
-- Renamed from 20261124130000 (the same version as home_properties_city); `create or replace` makes it safe whether or not the old version was already applied.
-- Why: with the lists behind sign-in, the assistant's `list_localities` and `get_builder` tools may only read for a
-- signed-in customer, and part C closes the table grants to visitors who are not signed in. Both functions run with
-- the owner's rights, repeat the public row rule (approved homes; approved, published projects of active builders:
-- BR-90, BR-42, BR-94) in their own where clauses, and only `authenticated` may run them.
-- Rollback note: nothing stored depends on these functions. To go back, add a migration that drops them.

-- The locality of every approved home (up to 10,000) and of every live project of an active builder (up to 1,000), as
-- plain names, for the assistant to count; the flags say a read stopped at its cap.
create or replace function public.live_locality_names()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with homes as (
    select home.locality
    from public.properties as home
    where home.status = 'approved' and home.locality is not null
    order by home.short_id
    limit 10001
  ),
  projects as (
    select project.locality
    from public.projects as project
    join public.builders as builder on builder.id = project.builder_id and builder.active
    where project.moderation = 'approved' and project.published and project.locality is not null
    order by project.slug
    limit 1001
  )
  select jsonb_build_object(
    'homes', coalesce((select jsonb_agg(locality) from (select locality from homes limit 10000) as shown), '[]'::jsonb),
    'homes_complete', (select count(*) from homes) <= 10000,
    'projects', coalesce((select jsonb_agg(locality) from (select locality from projects limit 1000) as shown), '[]'::jsonb),
    'projects_complete', (select count(*) from projects) <= 1000
  )
$$;

-- One active builder's newest live projects (at most p_limit, 1 to 50), how many live projects they have in all,
-- and the day the earliest was created. Null when no active builder has the id.
create or replace function public.live_builder_projects(p_builder uuid, p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'projects', coalesce((
      select jsonb_agg(to_jsonb(newest) order by newest.created_at desc)
      from (
        select project.slug, project.name, project.project_status, project.locality, project.possession_date,
          project.rera_applicable, project.rera_number, project.created_at
        from public.projects as project
        where project.builder_id = builder.id and project.moderation = 'approved' and project.published
        order by project.created_at desc
        limit least(greatest(coalesce(p_limit, 10), 1), 50)
      ) as newest
    ), '[]'::jsonb),
    'project_count', (
      select count(*) from public.projects as project
      where project.builder_id = builder.id and project.moderation = 'approved' and project.published
    ),
    'first_project_at', (
      select min(project.created_at) from public.projects as project
      where project.builder_id = builder.id and project.moderation = 'approved' and project.published
    )
  )
  from public.builders as builder
  where builder.id = p_builder and builder.active
$$;

revoke execute on function public.live_locality_names() from public, anon;
revoke execute on function public.live_builder_projects(uuid, integer) from public, anon;
grant execute on function public.live_locality_names() to authenticated, service_role;
grant execute on function public.live_builder_projects(uuid, integer) to authenticated, service_role;
