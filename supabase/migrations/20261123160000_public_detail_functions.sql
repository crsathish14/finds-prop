-- Login wall, part A (additive): narrow read functions for the pages that stay public.
-- Why: today a visitor holds the public key in every browser and can read whole lists through the table grants
-- and through search_properties(). Before those are closed (part C), the public pages (one home, one project, the
-- homepage sections, the sitemap) must stop depending on them. Each function below returns ONE row or a small
-- fixed set, runs with the owner's rights (security definer) and repeats the visibility rule of the row policy in
-- its own where clause, so what a visitor may see does not change: approved homes; approved, published projects
-- of active builders (BR-42, BR-90, BR-94). Nothing is revoked here, so nothing breaks while the code moves over.
-- Rollback note: nothing stored depends on these functions. To go back, add a migration that drops them.

-- One approved home by its public id: the columns a visitor may read, its photos and its label, as one document.
-- Null when no approved home has the id.
create function public.public_property(p_short_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'id', home.id, 'short_id', home.short_id, 'slug', home.slug, 'listing_type', home.listing_type,
      'property_type', home.property_type, 'title', home.title, 'description', home.description,
      'bhk', home.bhk, 'bathrooms', home.bathrooms, 'area_sqft', home.area_sqft, 'price', home.price,
      'furnishing', home.furnishing, 'amenities', home.amenities, 'available_from', home.available_from,
      'locality', home.locality, 'city', home.city, 'state', home.state, 'featured', home.featured,
      'published_at', home.published_at
    ),
    'photos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'storage_path', media.storage_path, 'alt_text', media.alt_text,
          'position', media.position, 'is_cover', media.is_cover
        )
        order by media.position
      )
      from public.listing_media as media
      where media.listing_id = home.id
    ), '[]'::jsonb),
    'label', public.listing_label(home.price, home.listing_type, home.featured)
  )
  from public.properties as home
  where home.short_id = p_short_id and home.status = 'approved'
$$;

-- One live project by its slug: the public columns with its (active) builder, its first 20 units, the number of
-- units and of those available, and the latest 12 months of its price trend. Null when no live project of an
-- active builder has the slug.
create function public.public_project(p_slug text)
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
      'offer_type', project.offer_type, 'price', project.price, 'price_type', project.price_type,
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

-- The homepage sections of homes: 'featured' (six) or 'newest' (eight), newest first, in the shape of
-- search_properties(). The sizes are fixed here, so a caller cannot ask for a list.
create function public.home_properties(p_kind text)
returns table (
  id uuid,
  short_id text,
  slug text,
  listing_type text,
  property_type text,
  title text,
  bhk smallint,
  bathrooms smallint,
  area_sqft numeric,
  price bigint,
  furnishing text,
  locality text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  featured boolean,
  label text,
  published_at timestamptz,
  cover_path text,
  cover_alt text,
  total_count bigint,
  distance_km double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind = 'featured' then
    return query select * from public.search_properties(p_label => 'featured', p_sort => 'newest', p_limit => 6);
  elsif p_kind = 'newest' then
    return query select * from public.search_properties(p_sort => 'newest', p_limit => 8);
  else
    raise exception 'home.invalid_kind' using errcode = '22023';
  end if;
end;
$$;

-- The live projects that rank the homepage developers: at most 1000, featured first then newest, each with only
-- its cover picture and its (active) builder's id, name and description.
create function public.home_developers()
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
    order by project.featured desc, project.created_at desc
    limit 1000
  ) as ranked
$$;

-- The addresses the sitemap lists, one page at a time (at most 1000 a page): 'homes' (slug, public id, change date)
-- or 'projects' (slug, change date). Slug and date only, no other data.
create function public.sitemap_entries(p_kind text, p_limit integer default 1000, p_offset integer default 0)
returns table (slug text, short_id text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_offset is null or p_offset < 0 then
    raise exception 'sitemap.invalid_page' using errcode = '22023';
  end if;
  if p_kind = 'homes' then
    return query
      select home.slug, home.short_id, home.updated_at
      from public.properties as home
      where home.status = 'approved'
      order by home.updated_at desc, home.short_id
      limit least(p_limit, 1000) offset p_offset;
  elsif p_kind = 'projects' then
    return query
      select project.slug, null::text, project.updated_at
      from public.projects as project
      join public.builders as builder on builder.id = project.builder_id and builder.active
      where project.moderation = 'approved' and project.published
      order by project.updated_at desc, project.slug
      limit least(p_limit, 1000) offset p_offset;
  else
    raise exception 'sitemap.invalid_kind' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.public_property(text) from public;
revoke execute on function public.public_project(text) from public;
revoke execute on function public.home_properties(text) from public;
revoke execute on function public.home_developers() from public;
revoke execute on function public.sitemap_entries(text, integer, integer) from public;
grant execute on function public.public_property(text) to anon, authenticated, service_role;
grant execute on function public.public_project(text) to anon, authenticated, service_role;
grant execute on function public.home_properties(text) to anon, authenticated, service_role;
grant execute on function public.home_developers() to anon, authenticated, service_role;
grant execute on function public.sitemap_entries(text, integer, integer) to anon, authenticated, service_role;
