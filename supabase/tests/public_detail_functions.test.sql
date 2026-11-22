-- Login wall, part A: the five narrow read functions the public pages use (public_property, public_project,
-- home_properties, home_developers, sitemap_entries). Tests: DB-FN-public-detail (BR-42, BR-90, BR-94, ADR-017).
-- They run with the owner's rights, so each repeats the row rule of the policy it replaces; these tests run as a
-- visitor (anon) and prove the same rows come back as before, and no private column. Fictional data only.
begin;
select plan(24);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());

-- A home n with a fixed public id (hhhhhh, one letter, 2) and a fixed published date, so lists have one order.
create function pg_temp.home(n integer, listing_status text default 'approved', is_featured boolean default false)
returns void
language sql
as $$
  insert into public.properties (
    id, short_id, owner_id, status, featured, listing_type, property_type, bhk, title, description, price,
    area_sqft, locality, city, state, pincode, address, location, published_at
  ) values (
    ('00000000-0000-4000-9000-0000000000' || lpad(n::text, 2, '0'))::uuid,
    'hhhhhh' || substr('abcdefghjkmnpq', n, 1) || '2',
    '00000000-0000-4000-8000-0000000000a1', listing_status, is_featured, 'sale', 'apartment', 2,
    'Sea view apartment ' || n, 'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai',
    'Tamil Nadu', '600020', '12 Beach Road',
    extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography,
    '2026-01-01'::timestamptz + make_interval(days => n)
  )
$$;

-- Home 1 has two photos (added while it is a draft, then reviewed and approved, as the real flow goes);
-- home 2 waits for review; home 3 is sold; homes 4 to 13 are approved, and 4 and 5 are featured.
select pg_temp.home(1, 'draft');
insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, position, alt_text)
values
  ('00000000-0000-4000-9000-000000000001', 'one/first.webp', 'image/webp', 50000, 1600, 1200, 1, 'Front'),
  ('00000000-0000-4000-9000-000000000001', 'one/second.webp', 'image/webp', 50000, 1600, 1200, 2, null);
update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000001';
update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000001';
select pg_temp.home(2, 'pending');
select pg_temp.home(3, 'sold');
select pg_temp.home(n, 'approved', n in (4, 5)) from generate_series(4, 13) as n;

-- Projects: kadal-vista is live with two units and two months of trend; hidden-vista is not published;
-- closed-vista belongs to an inactive builder.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name, active) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes', true),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', 'Closed Homes', false);
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at, images) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001',
    'OMR Navalur', 'approved', true, now(), array['kadal/cover.webp', 'kadal/two.webp']),
  ('00000000-0000-4000-c000-000000000002', 'hidden-vista', 'Hidden Vista', '00000000-0000-4000-b000-000000000001',
    'OMR Navalur', 'approved', false, now(), '{}'),
  ('00000000-0000-4000-c000-000000000003', 'closed-vista', 'Closed Vista', '00000000-0000-4000-b000-000000000002',
    'OMR Navalur', 'approved', true, now(), '{}');
insert into public.project_units (project_id, unit_number, floor_number, bhk, area_sqft, price, status) values
  ('00000000-0000-4000-c000-000000000001', 'A-10', 2, 2, 1050, 7800000, 'sold'),
  ('00000000-0000-4000-c000-000000000001', 'A-2', 2, 2, 1050, 7800000, 'available'),
  ('00000000-0000-4000-c000-000000000001', 'B-1', 1, 3, 1400, 9800000, 'available');
insert into public.project_price_trends (project_id, month, price_per_sqft) values
  ('00000000-0000-4000-c000-000000000001', '2026-09-01', 8230),
  ('00000000-0000-4000-c000-000000000001', '2026-10-01', 8350);

set local role anon;

-- public_property --------------------------------------------------------------------------------------------
select is(
  public.public_property('hhhhhha2') -> 'property' ->> 'title',
  'Sea view apartment 1',
  'public_property gives an approved home to a visitor'
);
select is(
  (select jsonb_agg(photo ->> 'storage_path') from jsonb_array_elements(public.public_property('hhhhhha2') -> 'photos') as photo),
  '["one/first.webp", "one/second.webp"]'::jsonb,
  'public_property gives the photos in their order'
);
select is(
  (select array_agg(key order by key collate "C") from jsonb_object_keys(public.public_property('hhhhhha2') -> 'property') as key),
  array['amenities', 'area_sqft', 'available_from', 'bathrooms', 'bhk', 'city', 'description', 'featured', 'furnishing',
    'id', 'listing_type', 'locality', 'price', 'property_type', 'published_at', 'short_id', 'slug', 'state', 'title']
    ::text[],
  'public_property gives only the visitor columns: no owner, address, pincode, exact location or status'
);
select is(
  public.public_property('hhhhhha2') -> 'label',
  'null'::jsonb,
  'public_property gives the label of the home (here none: 85 lakh is neither prime nor budget)'
);
select is(public.public_property('hhhhhhb2'), null, 'public_property gives nothing for a home waiting for review');
select is(public.public_property('hhhhhhc2'), null, 'public_property gives nothing for a sold home');
select is(public.public_property('zzzzzzzz'), null, 'public_property gives nothing for an id nobody has');

-- public_project ---------------------------------------------------------------------------------------------
select is(
  public.public_project('kadal-vista') -> 'project' -> 'builders' ->> 'name',
  'Kadal Homes',
  'public_project gives a live project with its active builder'
);
select is(
  (public.public_project('kadal-vista') ->> 'unit_count')::int || ' of ' ||
    (public.public_project('kadal-vista') ->> 'available_count')::int,
  '3 of 2',
  'public_project counts the units and the available ones'
);
select is(
  (select jsonb_agg(unit ->> 'unit_number') from jsonb_array_elements(public.public_project('kadal-vista') -> 'units') as unit),
  '["B-1", "A-10", "A-2"]'::jsonb,
  'public_project gives the units by floor, then by number'
);
select is(
  (select jsonb_agg(point ->> 'month') from jsonb_array_elements(public.public_project('kadal-vista') -> 'trend') as point),
  '["2026-10-01", "2026-09-01"]'::jsonb,
  'public_project gives the price trend, latest month first'
);
select ok(
  not (public.public_project('kadal-vista') -> 'project') ?| array['moderation', 'published', 'form_id', 'latitude', 'longitude', 'address', 'rejection_reason'],
  'public_project gives no moderation state, form link, address or coordinates'
);
select is(public.public_project('hidden-vista'), null, 'public_project gives nothing for a project that is not published');
select is(public.public_project('closed-vista'), null, 'public_project gives nothing for a project of an inactive builder');

-- home_properties --------------------------------------------------------------------------------------------
select is(
  (select array_agg(short_id order by short_id) from public.home_properties('featured')),
  array['hhhhhhd2', 'hhhhhhe2'],
  'home_properties(featured) gives the featured approved homes only'
);
select is(
  (select count(*)::int from public.home_properties('newest')),
  8,
  'home_properties(newest) gives eight homes, however many there are'
);
select is(
  (select short_id from public.home_properties('newest') order by published_at desc limit 1),
  'hhhhhhp2',
  'home_properties(newest) starts with the newest home'
);
select throws_ok(
  $$select * from public.home_properties('everything')$$,
  '22023',
  'home.invalid_kind',
  'home_properties refuses any other kind, so it cannot be asked for a list'
);

-- home_developers --------------------------------------------------------------------------------------------
select is(
  (select jsonb_agg(entry ->> 'slug') from jsonb_array_elements(public.home_developers()) as entry),
  '["kadal-vista"]'::jsonb,
  'home_developers gives only live projects of active builders'
);
select is(
  public.home_developers() -> 0 -> 'images',
  '["kadal/cover.webp"]'::jsonb,
  'home_developers gives only the cover picture of a project'
);

-- sitemap_entries --------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from public.sitemap_entries('homes')),
  11,
  'sitemap_entries(homes) lists the approved homes only (waiting and sold homes are left out)'
);
select is(
  (select array_agg(slug) from public.sitemap_entries('projects')),
  array['kadal-vista'],
  'sitemap_entries(projects) lists the live projects of active builders only'
);
select throws_ok(
  $$select * from public.sitemap_entries('homes', 0)$$,
  '22023',
  'sitemap.invalid_page',
  'sitemap_entries refuses a page of no rows'
);

reset role;

-- All five run with the owner's rights, so each pins its search_path.
select is(
  (select count(*)::int
   from pg_proc as proc
   where proc.pronamespace = 'public'::regnamespace
     and proc.proname in ('public_property', 'public_project', 'home_properties', 'home_developers', 'sitemap_entries')
     and proc.prosecdef
     and proc.proconfig @> array['search_path=""']),
  5,
  'the five functions are security definer and pin their search_path'
);

select * from finish();
rollback;
