-- Login wall follow-up: public_project() gives the project's extra fields too.
-- Why: the project page reads one project through public_project() (login wall, part A). Plan 8 added the project's
-- `extra_fields` (20261123160000_project_extra_fields.sql) to the page's read at the same time, so the function left
-- them out and the page silently showed none. The function is the same as before with one more key.
-- Rollback note: nothing stored depends on it. To go back, add a migration that makes the function again without the key.

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
