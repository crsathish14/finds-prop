-- Login wall, part B: the projects list for signed-in visitors only.
-- Why: the list of projects is behind the sign-in wall. The table grant to anon is closed in part C; until
-- then this function is how the list page reads, and only `authenticated` may run it. It repeats the row rule
-- of the public policy (approved, published, active builder: BR-42, BR-94) in its own where clause, because a
-- signed-in builder or admin can also read other rows of the table through their own policies, and the list
-- must show the same projects to everybody.
-- Rollback note: nothing stored depends on this function. To go back, add a migration that drops it.

create function public.live_project_list(p_limit integer default 60)
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
        'bhk_options', live.bhk_options, 'locality', live.locality, 'images', live.images,
        'featured', live.featured,
        'builders', jsonb_build_object('id', live.builder_id, 'name', live.builder_name)
      )
      order by live.featured desc, live.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select project.slug, project.name, project.project_status, project.offer_type, project.price,
      project.price_type, project.bhk_options, project.locality, project.images, project.featured,
      project.created_at, project.builder_id, builder.name as builder_name
    from public.projects as project
    join public.builders as builder on builder.id = project.builder_id and builder.active
    where project.moderation = 'approved' and project.published
    order by project.featured desc, project.created_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 120)
  ) as live
$$;

revoke execute on function public.live_project_list(integer) from public, anon;
grant execute on function public.live_project_list(integer) to authenticated, service_role;
