-- S4-T13 public projections (ADR-017, FR-SYS-08, R-DB-06, DEC-35).
-- Tests: DB-RLS-column-grants (the catch-all: exactly which columns and functions a visitor gets),
-- DB-RLS-projection-rounding (a home's public point is rounded, a project's is exact).
-- The per-table tests in the other files name the columns a visitor must NOT read. This file lists the
-- ones a visitor MAY read, so a later migration that grants one more column fails here until
-- somebody agrees it is public. The row rules (approved homes, live projects, active builders) are
-- tested in listings_properties, listings_media, search, projects and builders; the integration test
-- tests/integration/public-queries.test.ts (IT-queries) checks them again through the real client.
-- Fictional data only.
begin;
select plan(7);

-- The agreed public columns, one row per table and column. A column that is public by design is
-- listed here on purpose: project contact phone, RERA number, address and coordinates (projects keep
-- exact coordinates, DEC-35), the fields and project of an active form, and all of site_settings.
create temporary table expected_public_columns (table_name text, column_name text);
insert into expected_public_columns (table_name, column_name)
select expected.table_name, unnest(expected.columns)
from (values
  ('properties', array[
    'id', 'short_id', 'slug', 'listing_type', 'property_type', 'title', 'description', 'bhk',
    'bathrooms', 'area_sqft', 'price', 'furnishing', 'amenities', 'available_from', 'locality',
    'city', 'state', 'pincode', 'public_location', 'status', 'featured', 'published_at',
    'created_at', 'updated_at', 'search_vector'
  ]),
  ('listing_media', array[
    'id', 'listing_id', 'storage_path', 'mime', 'bytes', 'width', 'height', 'position', 'is_cover',
    'alt_text', 'created_at'
  ]),
  ('builders', array['id', 'name', 'logo_url', 'website', 'description']),
  ('projects', array[
    'id', 'slug', 'name', 'builder_id', 'project_type', 'property_type', 'project_status',
    'price_min', 'price_max', 'bhk_options', 'land_area_acres', 'total_units', 'possession_date',
    'contact_phone', 'locality', 'address', 'latitude', 'longitude', 'location', 'advantages',
    'nearby', 'rera_applicable', 'rera_number', 'description', 'specifications', 'amenities',
    'images', 'floor_plans', 'elevations', 'plot_images', 'videos', 'brochure_path', 'seo_title',
    'seo_description', 'featured', 'created_at', 'updated_at'
  ]),
  ('project_units', array[
    'id', 'project_id', 'unit_number', 'floor_number', 'bhk', 'area_sqft', 'facing', 'price',
    'available_from', 'floor_plan_path', 'status', 'created_at', 'updated_at'
  ]),
  ('project_price_trends', array['id', 'project_id', 'month', 'price_per_sqft', 'created_at']),
  ('forms', array[
    'id', 'name', 'slug', 'kind', 'placement', 'project_id', 'button_text', 'success_message',
    'fields', 'active', 'created_at', 'updated_at'
  ]),
  ('site_settings', array['key', 'value', 'updated_at'])
) as expected (table_name, columns);

-- 1. Every column anon can read, on every relation in the public schema
select set_eq(
  $$
    select class.relname::text, attribute.attname::text
    from pg_class as class
    join pg_namespace as space on space.oid = class.relnamespace
    join pg_attribute as attribute on attribute.attrelid = class.oid
    where space.nspname = 'public'
      and class.relkind in ('r', 'p', 'v', 'm')
      and attribute.attnum > 0
      and not attribute.attisdropped
      and has_column_privilege('anon', class.oid, attribute.attname, 'SELECT')
  $$,
  $$select table_name, column_name from expected_public_columns$$,
  'DB-RLS-column-grants: anon can read exactly the agreed columns, and nothing in any other table'
);

-- 2. The same list, with names: the columns that must never reach a visitor
select is_empty(
  $$
    select class.relname::text, attribute.attname::text
    from pg_class as class
    join pg_namespace as space on space.oid = class.relnamespace
    join pg_attribute as attribute on attribute.attrelid = class.oid
    where space.nspname = 'public'
      and attribute.attnum > 0
      and not attribute.attisdropped
      and has_column_privilege('anon', class.oid, attribute.attname, 'SELECT')
      and (class.relname::text, attribute.attname::text) in (
        ('properties', 'owner_id'), ('properties', 'address'), ('properties', 'location'),
        ('properties', 'rejection_reason'), ('properties', 'moderated_by'),
        ('properties', 'moderated_at'), ('properties', 'submitted_at'), ('properties', 'closed_at'),
        ('projects', 'moderation'), ('projects', 'published'), ('projects', 'rejection_reason'),
        ('projects', 'moderated_by'), ('projects', 'moderated_at'), ('projects', 'form_id'),
        ('builders', 'user_id'), ('builders', 'email'), ('builders', 'contact_person'),
        ('builders', 'phone'), ('builders', 'active'), ('forms', 'crm_integration_id')
      )
  $$,
  'DB-RLS-column-grants: no owner, exact location, private address, moderation, builder contact or CRM column is readable'
);

-- 3. Signed-in customers get the same columns on these tables, not more
select set_eq(
  $$
    select class.relname::text, attribute.attname::text
    from pg_class as class
    join pg_namespace as space on space.oid = class.relnamespace
    join pg_attribute as attribute on attribute.attrelid = class.oid
    where space.nspname = 'public'
      and class.relname in (
        'properties', 'listing_media', 'builders', 'projects', 'project_units',
        'project_price_trends', 'forms', 'site_settings'
      )
      and attribute.attnum > 0
      and not attribute.attisdropped
      and has_column_privilege('authenticated', class.oid, attribute.attname, 'SELECT')
  $$,
  $$select table_name, column_name from expected_public_columns$$,
  'DB-RLS-column-grants: a signed-in customer reads the same columns of these tables as a visitor'
);

-- 4. The functions a visitor can run. The two helpers are needed by the row policies, which run with
-- the caller's rights; both only answer yes or no about an id. public_project_form answers which form a
-- project page shows (S5-T05, BR-49), because visitors cannot read projects.form_id; it returns only the
-- columns of an active form a visitor may already read, and nothing for a project they cannot see.
select set_eq(
  $$
    select proc.proname::text
    from pg_proc as proc
    join pg_namespace as space on space.oid = proc.pronamespace
    where space.nspname = 'public'
      and has_function_privilege('anon', proc.oid, 'EXECUTE')
  $$,
  $$values ('listing_is_public'), ('listing_label'), ('project_is_live'), ('public_project_form'), ('search_properties')$$,
  'DB-RLS-column-grants: anon can run only the search, the label, the project form lookup and the two row-policy helpers in the public schema'
);

-- Data for the rounding checks: one approved home with an exact point, one live project.
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());
insert into public.properties (
  id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
  locality, city, state, pincode, address, location
) values (
  '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'approved',
  'sale', 'apartment', 'Sea view apartment', 'A bright two bedroom flat near the sea.', 8500000, 950,
  'Adyar', 'Chennai', 'Tamil Nadu', '600020', '12 Beach Road',
  extensions.st_setsrid(extensions.st_makepoint(80.27074, 13.08274), 4326)::extensions.geography
);
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now());
insert into public.user_roles (user_id, role)
values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');
insert into public.projects (
  id, slug, name, builder_id, locality, moderation, published, moderated_at, latitude, longitude
) values (
  '00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista',
  '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now(), 13.082741,
  80.270741
);

set local role anon;

-- 5. DEC-35: a home's public point is the exact one rounded to the 0.001 degree grid
select ok(
  (select abs(extensions.st_x(public_location::extensions.geometry) - 80.271) < 0.0000001
      and abs(extensions.st_y(public_location::extensions.geometry) - 13.083) < 0.0000001
   from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'DEC-35: a visitor gets the home''s point rounded to 80.271, 13.083, not the exact 80.27074, 13.08274'
);

-- 6. ... while a project keeps its exact point, as a pair and as a point
select ok(
  (select latitude = 13.082741 and longitude = 80.270741
      and abs(extensions.st_x(location::extensions.geometry) - 80.270741) < 0.0000001
      and abs(extensions.st_y(location::extensions.geometry) - 13.082741) < 0.0000001
   from public.projects where id = '00000000-0000-4000-c000-000000000001'),
  'DEC-35: a project keeps its exact coordinates for a visitor'
);

-- 7. A visitor still cannot ask for the exact point by any route
select throws_ok(
  $$select location from public.properties$$,
  '42501', null, 'DEC-35: the exact location of a home stays unreadable'
);

reset role;
select * from finish();
rollback;
