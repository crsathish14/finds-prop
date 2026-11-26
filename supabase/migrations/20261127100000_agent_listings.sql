-- The agent's own page shows their newest homes and projects (owner decision, 26 Nov 2026: everyone, six of each).
-- agent_listings(p_id) gives, for one active agent (a builders row with kind = 'agent'), at most six approved homes they
-- own (newest first) and at most six approved, published projects (featured first, then newest), each with only what a card
-- draws. A small fixed set for one agent, like the homepage rows, so it is not a list the login wall (ADR-171) closes; it
-- never gives a phone or an email. An id that is no active agent gives empty lists.
-- Rollback note: nothing here is destructive. Fix forward with a new migration (drop the function if needed).

create or replace function public.agent_listings(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with agent as (
    select builder.id, builder.user_id, builder.name
    from public.builders as builder
    where builder.id = p_id and builder.kind = 'agent' and builder.active
  )
  select jsonb_build_object(
    'homes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'short_id', home.short_id, 'slug', home.slug, 'listing_type', home.listing_type,
          'property_type', home.property_type, 'title', home.title, 'bhk', home.bhk, 'bathrooms', home.bathrooms,
          'area_sqft', home.area_sqft, 'price', home.price, 'locality', home.locality, 'city', home.city,
          'label', public.listing_label(home.price, home.listing_type, home.featured),
          'published_at', home.published_at, 'cover_path', cover.storage_path, 'cover_alt', cover.alt_text
        )
        order by home.published_at desc nulls last, home.short_id
      )
      from (
        select listing.*
        from public.properties as listing
        where listing.owner_id = (select agent.user_id from agent) and listing.status = 'approved'
        order by listing.published_at desc nulls last, listing.short_id
        limit 6
      ) as home
      left join lateral (
        select media.storage_path, media.alt_text
        from public.listing_media as media
        where media.listing_id = home.id and media.is_cover
        limit 1
      ) as cover on true
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', project.slug, 'name', project.name, 'project_status', project.project_status,
          'offer_type', project.offer_type, 'price', project.price, 'price_type', project.price_type,
          'bhk_options', project.bhk_options, 'locality', project.locality, 'images', project.images[1:1],
          'featured', project.featured, 'builders', jsonb_build_object('id', agent.id, 'name', agent.name)
        )
        order by project.featured desc, project.created_at desc, project.slug
      )
      from (
        select live.*
        from public.projects as live
        where live.builder_id = (select agent_row.id from agent as agent_row)
          and live.moderation = 'approved' and live.published
        order by live.featured desc, live.created_at desc, live.slug
        limit 6
      ) as project
      cross join agent
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.agent_listings(uuid) from public;
grant execute on function public.agent_listings(uuid) to anon, authenticated, service_role;
