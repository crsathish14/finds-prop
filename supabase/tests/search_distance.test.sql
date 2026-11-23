-- F10 search, place search PR 5: the `distance` sort and the distance_km column (ADR-135).
-- Tests: DB-FN-search-distance (FR-GEO-03, BR-90, BR-91, DEC-35).
-- Fictional listings only. Listing n has the id ...0000000000nn, so a result can be read as a list of
-- numbers. The data is the search test's, so the four older sorts can be held to the orders that test
-- already expects. The tests run as a visitor (anon) unless a section says otherwise, because that is who
-- uses the search and the function runs with the caller's rights.
-- The picked point is 13.083, 80.271: the public (rounded to 0.001 degree) point of the Adyar listings, so
-- they are at distance 0 and tie. Hand-worked distances to the public points of the others (WGS 84):
--   listing 4  Anna Nagar   (80.209, 13.085)   6.73 km
--   listing 14 north        (80.271, 13.183)  11.06 km
--   listing 2  Velachery    (80.221, 12.982)  12.42 km
begin;
select plan(39);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());

create function pg_temp.add_listing(
  n integer,
  listing_status text default 'approved',
  kind text default 'sale',
  property_kind text default 'apartment',
  bedrooms smallint default 2,
  amount bigint default 8000000,
  area numeric default 900,
  place text default 'Adyar',
  town text default 'Chennai',
  lng double precision default 80.2707,
  lat double precision default 13.0827,
  listing_title text default 'Bright apartment',
  is_featured boolean default false
) returns void
language sql
as $$
  insert into public.properties (
    id, owner_id, status, featured, listing_type, property_type, bhk, title, description, price,
    area_sqft, locality, city, state, pincode, address, location, published_at
  ) values (
    ('00000000-0000-4000-9000-0000000000' || lpad(n::text, 2, '0'))::uuid,
    '00000000-0000-4000-8000-0000000000a1', listing_status, is_featured, kind, property_kind,
    bedrooms, listing_title, 'A fictional listing for the search tests.', amount, area, place, town,
    'Tamil Nadu', '600020', '12 Beach Road',
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
    '2026-01-01'::timestamptz + make_interval(days => n)
  )
$$;

-- Approved: 1, 2, 3, 4, 5, 6, 11, 12. Not approved: 7 draft, 8 pending, 9 sold, 10 rented.
select pg_temp.add_listing(1);
select pg_temp.add_listing(2, property_kind => 'villa', bedrooms => 4::smallint, amount => 20000000,
  area => 2400, place => 'Velachery', lng => 80.2209, lat => 12.9815, listing_title => 'Garden villa');
select pg_temp.add_listing(3, kind => 'rent', bedrooms => 1::smallint, amount => 15000, area => 500,
  lng => 80.2710, lat => 13.0830, listing_title => 'Cosy studio');
select pg_temp.add_listing(4, kind => 'rent', property_kind => 'house', bedrooms => 3::smallint,
  amount => 70000, area => 1500, place => 'Anna Nagar', lng => 80.2090, lat => 13.0850,
  listing_title => 'Family house');
select pg_temp.add_listing(5, property_kind => 'plot', bedrooms => null, amount => 5000000, area => 1200,
  place => 'Gandhipuram', town => 'Coimbatore', lng => 76.9558, lat => 11.0168,
  listing_title => 'Corner plot');
select pg_temp.add_listing(6, bedrooms => 3::smallint, amount => 9000000, area => 1100,
  listing_title => 'Featured sea view flat', is_featured => true);
select pg_temp.add_listing(7, listing_status => 'draft');
select pg_temp.add_listing(8, listing_status => 'pending');
select pg_temp.add_listing(9, listing_status => 'sold');
select pg_temp.add_listing(10, listing_status => 'rented');
select pg_temp.add_listing(11, amount => 7500000);
select pg_temp.add_listing(12, listing_title => 'Twin apartment');

-- How the function is built
select ok(
  (select pg_get_function_result(oid) like '%total_count bigint, distance_km double precision)'
   from pg_proc where proname = 'search_properties' and pronamespace = 'public'::regnamespace),
  'the result ends with the new column distance_km (double precision), after total_count'
);
select ok(
  (select not prosecdef and provolatile = 's' and coalesce(proconfig::text like '%search_path=%', false)
   from pg_proc where proname = 'search_properties' and pronamespace = 'public'::regnamespace),
  'search_properties still runs as the caller, is stable and pins its search_path'
);
select ok(
  not exists (
    select 1
    from pg_proc as proc, unnest(proc.proargnames) as output(name)
    where proc.proname = 'search_properties'
      and output.name in ('owner_id', 'address', 'location', 'description', 'pincode', 'status', 'search_vector')
  ),
  'search_properties still has no owner, address, exact location, description, pincode, status or vector column'
);
select ok(
  not has_function_privilege('anon', 'public.search_properties(text, text, integer, bigint, bigint, text, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text, text, text, integer, text)', 'EXECUTE'),
  'visitors who are not signed in may not run the search (login wall; 17 arguments and the new city one)'
);
select ok(
  has_function_privilege('authenticated', 'public.search_properties(text, text, integer, bigint, bigint, text, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text, text, text, integer, text)', 'EXECUTE'),
  'signed-in people may run the search'
);
select ok(
  has_function_privilege('service_role', 'public.search_properties(text, text, integer, bigint, bigint, text, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text, text, text, integer, text)', 'EXECUTE'),
  'the service role may run the search'
);
select ok(
  not exists (
    select 1
    from pg_proc as proc, aclexplode(proc.proacl) as privilege
    where proc.proname = 'search_properties' and proc.pronamespace = 'public'::regnamespace
      and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
  ),
  'execute is not granted to public: the revoke was made again after the function was recreated'
);

-- A visitor: the four older sorts return what they returned before
set local role authenticated; -- login wall: the lists are for signed-in people (no user: sees approved rows only)

select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'newest', p_limit => 120)),
  array[12, 11, 6, 5, 4, 3, 2, 1],
  'newest first, as before'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_asc', p_limit => 120)),
  array[3, 4, 5, 11, 1, 12, 6, 2],
  'cheapest first, equal prices by id, as before'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_desc', p_limit => 120)),
  array[2, 6, 12, 1, 11, 5, 4, 3],
  'dearest first, equal prices by id, as before'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'area_desc', p_limit => 120)),
  array[2, 4, 5, 6, 1, 11, 12, 3],
  'largest first, equal areas by id, as before'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_limit => 120)),
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'newest', p_limit => 120)),
  'the default sort is still newest'
);
select throws_ok($$select * from public.search_properties(p_sort => 'random')$$, '22023', 'search.invalid_sort', 'an unknown sort is still refused');
select is(
  (select count(*)::int from public.search_properties(p_limit => 120) where distance_km is not null),
  0,
  'distance_km is null on every row when no place was given'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 15, p_sort => 'newest', p_limit => 120)),
  array[12, 11, 6, 4, 3, 2, 1],
  'with a place and an older sort, the order is that sort''s, not the distance'
);
select is(
  (select count(*)::int from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 15, p_sort => 'newest', p_limit => 120) where distance_km is null),
  0,
  'with a place, every row carries its distance whatever the sort'
);

reset role;

-- Two more approved listings: 13 has no location at all, 14 is 0.1 degree (about 11 km) north of the picked point.
select pg_temp.add_listing(13, lng => null, lat => null, listing_title => 'Listing without a map point');
select pg_temp.add_listing(14, place => 'Red Hills', lng => 80.2710, lat => 13.1830, listing_title => 'North house');

set local role authenticated; -- login wall: the lists are for signed-in people (no user: sees approved rows only)

-- The distance sort (approved listings with a location within 50 km: 1, 3, 6, 11 and 12 at distance 0)
select is(
  (select array_agg(right(id::text, 2)::int)
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)),
  array[1, 3, 6, 11, 12, 4, 14, 2],
  'nearest first; the five listings at distance 0 are in id order; no draft, pending, sold, rented, far or location-less listing'
);
select is(
  (select array_agg(right(id::text, 2)::int)
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 3)),
  array[1, 3, 6],
  'a short page is the start of the full distance order'
);
select is(
  (select min(total_count)::int
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 3)),
  8,
  'every row still says how many listings matched before the limit'
);
select is(
  (select distance_km from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '01'),
  0::double precision,
  'a listing on the picked point is 0.0 km away'
);
select ok(
  (select abs(distance_km - 6.7) <= 0.1
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '04'),
  'Anna Nagar is about 6.7 km away'
);
select ok(
  (select abs(distance_km - 11.1) <= 0.1
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '14'),
  'a listing 0.1 degree north is about 11.1 km away'
);
select ok(
  (select abs(distance_km - 12.4) <= 0.15
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '02'),
  'Velachery is about 12.4 km away'
);
select ok(
  not exists (
    select 1
    from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
    where distance_km <> round(distance_km::numeric, 1)::double precision
  ),
  'every distance_km has at most one decimal'
);
select is(
  (select distance_km::numeric
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '04'),
  round((extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(80.209, 13.085), 4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(80.271, 13.083), 4326)::extensions.geography
  ) / 1000)::numeric, 1),
  'the distance is the geography distance between the two points in km, rounded to one decimal'
);

-- The distance sort needs a place
select throws_ok(
  $$select * from public.search_properties(p_sort => 'distance')$$,
  '22023', 'search.invalid_sort',
  'the distance sort with no place is refused like any bad sort'
);
select throws_ok(
  $$select * from public.search_properties(p_lat => 13.0, p_sort => 'distance')$$,
  '22023', 'search.invalid_place',
  'a latitude without a longitude is still an invalid place for the distance sort'
);
select throws_ok(
  $$select * from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_sort => 'random')$$,
  '22023', 'search.invalid_sort',
  'an unknown sort is refused with a place too'
);

-- The distance sort with other filters, and the listing with no location
select is(
  (select array_agg(right(id::text, 2)::int)
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_listing_type => 'rent', p_sort => 'distance', p_limit => 120)),
  array[3, 4],
  'filters combine with the distance sort'
);
select is(
  (select array_agg(right(id::text, 2)::int)
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_q => 'adyar', p_sort => 'distance', p_limit => 120)),
  array[1, 3, 6, 11, 12],
  'a keyword and a place together: the listing with no location is left out'
);
select is(
  (select count(*)::int
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_limit => 120)
   where right(id::text, 2) = '13'),
  0,
  'a listing with no location never appears in a radius search'
);
select ok(
  exists (select 1 from public.search_properties(p_q => 'without', p_limit => 120) where right(id::text, 2) = '13'),
  'but it is found by keyword'
);
select ok(
  exists (
    select 1 from public.search_properties(p_locality => 'adyar', p_limit => 120)
    where right(id::text, 2) = '13' and distance_km is null and latitude is null
  ),
  'and by locality text, with no distance and no position'
);
select is(
  (select count(*)::int
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) in ('07', '08', '09', '10')),
  0,
  'a draft, pending, sold or rented listing is never found, even on the picked point'
);

reset role;

-- A signed-in owner (who owns the draft too) still gets approved listings only
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select is(
  (select array_agg(right(id::text, 2)::int)
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)),
  array[1, 3, 6, 11, 12, 4, 14, 2],
  'the owner''s distance search returns approved listings only'
);
reset role;

-- The distance comes from public_location, never the exact private location. Listing 15's exact point is
-- 62 m from the picked point (a distance that would show as 0.1 km) but its public point, the rounded one,
-- is the picked point itself (0.0 km).
select pg_temp.add_listing(15, lng => 80.2714, lat => 13.0834, listing_title => 'Almost on the point');

set local role authenticated; -- login wall: the lists are for signed-in people (no user: sees approved rows only)

select is(
  (select distance_km
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '15'),
  0::double precision,
  'the distance is measured to the rounded public point (0.0 km), not the exact point (0.1 km)'
);

reset role;

-- Moving the private point far away moves the public one with it (it is generated from it): the distance
-- follows, and the listing is now found around Coimbatore, not around Adyar.
update public.properties
set location = extensions.st_setsrid(extensions.st_makepoint(76.9558, 11.0168), 4326)::extensions.geography
where id = '00000000-0000-4000-9000-000000000015';

set local role authenticated; -- login wall: the lists are for signed-in people (no user: sees approved rows only)

select is(
  (select count(*)::int
   from public.search_properties(p_lat => 13.083, p_lng => 80.271, p_radius_km => 50, p_sort => 'distance', p_limit => 120)
   where right(id::text, 2) = '15'),
  0,
  'after the point moved to Coimbatore the listing is no longer near Adyar'
);
select is(
  (select array_agg(right(id::text, 2)::int)
   from public.search_properties(p_lat => 11.017, p_lng => 76.956, p_radius_km => 5, p_sort => 'distance', p_limit => 120)),
  array[5, 15],
  'around Coimbatore, the two listings on the same rounded point are in id order'
);
select is(
  (select max(distance_km)
   from public.search_properties(p_lat => 11.017, p_lng => 76.956, p_radius_km => 5, p_sort => 'distance', p_limit => 120)),
  0::double precision,
  'and both are 0.0 km from the picked point'
);

reset role;

select * from finish();
rollback;
