-- F10 search. Tests: DB-FN-search (BR-90 to BR-92), DB-FN-listing_label.
-- Fictional listings only. Listing n has the id ...0000000000nn, so a result can be read as a list of
-- numbers. The tests run as a visitor (anon) unless a section says otherwise, because that is who
-- uses the search and the function runs with the caller's rights.
begin;
select plan(79);

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
select pg_temp.add_listing(11, listing_status => 'pending', amount => 7500000);
select pg_temp.add_listing(12, listing_title => 'Twin apartment');

-- Listing 11 gets two photos while it waits for review (adding one to an approved listing sends it
-- back to review), then is approved. The first photo becomes the cover.
insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, position, alt_text)
values
  ('00000000-0000-4000-9000-000000000011', 'owner/11/a.webp', 'image/webp', 50000, 1600, 1200, 0, 'Front of the flat'),
  ('00000000-0000-4000-9000-000000000011', 'owner/11/b.webp', 'image/webp', 50000, 1600, 1200, 1, 'Living room');
update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000011';

-- The label (BR-92): featured wins, then prime, then budget; limits are inclusive.
select is(public.listing_label(20000000, 'sale', true), 'featured', 'a featured listing is labelled featured, whatever its price');
select is(public.listing_label(15000000, 'sale', false), 'prime', 'a sale at exactly 1.5 crore is prime');
select is(public.listing_label(14999999, 'sale', false), null, 'a sale just under 1.5 crore has no label');
select is(public.listing_label(60000, 'rent', false), 'prime', 'a rent of exactly 60,000 is prime');
select is(public.listing_label(59999, 'rent', false), null, 'a rent just under 60,000 has no label');
select is(public.listing_label(6000000, 'sale', false), 'budget', 'a sale at exactly 60 lakh is budget');
select is(public.listing_label(6000001, 'sale', false), null, 'a sale just over 60 lakh has no label');
select is(public.listing_label(20000, 'rent', false), 'budget', 'a rent of exactly 20,000 is budget');
select is(public.listing_label(20001, 'rent', false), null, 'a rent just over 20,000 has no label');
select is(public.listing_label(null, 'sale', false), null, 'no price, no label');

-- How the functions are built
select ok(
  (select not prosecdef and provolatile = 's' and coalesce(proconfig::text like '%search_path=%', false)
   from pg_proc where proname = 'search_properties' and pronamespace = 'public'::regnamespace),
  'search_properties runs as the caller, is stable and pins its search_path'
);
select ok(
  (select provolatile = 'i' and not prosecdef and proconfig is null
   from pg_proc where proname = 'listing_label' and pronamespace = 'public'::regnamespace),
  'listing_label is immutable, runs as the caller and has no SET clause, so the planner can inline it'
);
select ok(
  not exists (
    select 1
    from pg_proc as proc, unnest(proc.proargnames) as output(name)
    where proc.proname = 'search_properties'
      and output.name in ('owner_id', 'address', 'location', 'description', 'pincode', 'status', 'search_vector')
  ),
  'search_properties has no owner, address, exact location, description, pincode, status or vector column'
);
select ok(
  has_function_privilege('anon', 'public.search_properties(text, text, integer, bigint, bigint, text, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text, text, text, integer)', 'EXECUTE'),
  'visitors may run the search'
);
select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and tablename = 'properties'
     and indexname like 'properties\_search\_%' and indexdef like '%WHERE%'),
  5,
  'the five search indexes exist and each covers approved listings only'
);

-- A visitor
set local role anon;

select lives_ok($$select search_vector from public.properties limit 1$$, 'a visitor can read the keyword vector');
select throws_ok($$select location from public.properties limit 1$$, '42501', null, 'a visitor still cannot read the exact location');

-- Only approved listings (BR-90)
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_limit => 120)$$,
  array[1, 2, 3, 4, 5, 6, 11, 12],
  'only approved listings are found: no draft, pending, sold or rented one'
);
select is(
  (select count(*)::int from public.search_properties()),
  8,
  'with no filter, eight approved listings fit in the default page (12)'
);

-- The count and the page size
select is((select count(*)::int from public.search_properties(p_limit => 3)), 3, 'the limit cuts the page');
select is(
  (select min(total_count)::int from public.search_properties(p_limit => 3)),
  8,
  'every row says how many listings matched before the limit'
);
select is(
  (select count(*)::int from public.search_properties(p_limit => 120)),
  8,
  'the largest page (120) is accepted'
);
select throws_ok($$select * from public.search_properties(p_limit => 0)$$, '22023', 'search.invalid_limit', 'a limit of 0 is refused');
select throws_ok($$select * from public.search_properties(p_limit => 121)$$, '22023', 'search.invalid_limit', 'a limit of 121 is refused');
select throws_ok($$select * from public.search_properties(p_limit => null)$$, '22023', 'search.invalid_limit', 'no limit is refused');

-- Each filter alone (BR-91)
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_listing_type => 'sale', p_limit => 120)$$,
  array[1, 2, 5, 6, 11, 12],
  'looking to buy finds the sale listings'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_listing_type => 'rent', p_limit => 120)$$,
  array[3, 4],
  'looking to rent finds the rental listings'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_property_type => 'villa', p_limit => 120)$$,
  array[2],
  'the property type filter finds villas'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_property_type => 'plot', p_limit => 120)$$,
  array[5],
  'the property type filter finds plots'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_bhk => 2, p_limit => 120)$$,
  array[1, 11, 12],
  'the bedroom filter takes one value'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_max_price => 8000000, p_limit => 120)$$,
  array[1, 3, 4, 5, 11, 12],
  'the maximum price includes the exact price'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_min_price => 8000000, p_max_price => 9000000, p_limit => 120)$$,
  array[1, 6, 12],
  'a price range includes both ends'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_locality => 'ADYAR', p_limit => 120)$$,
  array[1, 3, 6, 11, 12],
  'the locality text matches in any letter case'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_locality => 'nagar', p_limit => 120)$$,
  array[4],
  'the locality text matches part of a name'
);
select is(
  (select count(*)::int from public.search_properties(p_locality => '%', p_limit => 120)),
  0,
  'a percent sign in the locality text is just a character, not a wildcard'
);

-- Place: a radius around a picked point (about 6.7 km to Anna Nagar and 12.5 km to Velachery)
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_lat => 13.0827, p_lng => 80.2707, p_radius_km => 5, p_limit => 120)$$,
  array[1, 3, 6, 11, 12],
  'a 5 km radius around Adyar finds the Adyar listings'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_lat => 13.0827, p_lng => 80.2707, p_radius_km => 10, p_limit => 120)$$,
  array[1, 3, 4, 6, 11, 12],
  'a 10 km radius also reaches Anna Nagar'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_lat => 13.0827, p_lng => 80.2707, p_radius_km => 15, p_limit => 120)$$,
  array[1, 2, 3, 4, 6, 11, 12],
  'a 15 km radius also reaches Velachery, and never Coimbatore'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_lat => 13.0827, p_lng => 80.2707, p_limit => 120)$$,
  array[1, 3, 6, 11, 12],
  'the radius is 5 km when none is given'
);
select throws_ok($$select * from public.search_properties(p_lat => 13.0, p_lng => 80.2, p_radius_km => 0)$$, '22023', 'search.invalid_radius', 'a radius under 1 km is refused');
select throws_ok($$select * from public.search_properties(p_lat => 13.0, p_lng => 80.2, p_radius_km => 51)$$, '22023', 'search.invalid_radius', 'a radius over 50 km is refused');
select throws_ok($$select * from public.search_properties(p_lat => 13.0)$$, '22023', 'search.invalid_place', 'a latitude without a longitude is refused');
select throws_ok($$select * from public.search_properties(p_lat => 91, p_lng => 80)$$, '22023', 'search.invalid_place', 'a latitude outside the world is refused');

-- The map box
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_west => 80.20, p_south => 13.07, p_east => 80.28, p_north => 13.09, p_limit => 120)$$,
  array[1, 3, 4, 6, 11, 12],
  'a map box finds the listings inside it'
);
select throws_ok($$select * from public.search_properties(p_west => 80.2, p_south => 13.0, p_east => 80.3)$$, '22023', 'search.invalid_box', 'a box with a missing side is refused');
select throws_ok($$select * from public.search_properties(p_west => 80.3, p_south => 13.0, p_east => 80.2, p_north => 13.1)$$, '22023', 'search.invalid_box', 'a box with west of east is refused');

-- Keyword
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_q => 'cosy', p_limit => 120)$$,
  array[3],
  'a keyword finds a word in the title'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_q => 'garden villa', p_limit => 120)$$,
  array[2],
  'several keywords must all match'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_q => 'adyar', p_limit => 120)$$,
  array[1, 3, 6, 11, 12],
  'a keyword finds the locality'
);
select is(
  (select count(*)::int from public.search_properties(p_q => 'beach', p_limit => 120)),
  0,
  'the private address is not searchable'
);
select is(
  (select count(*)::int from public.search_properties(p_q => '   ', p_limit => 120)),
  8,
  'a blank keyword is no keyword'
);

-- Label
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_label => 'featured', p_limit => 120)$$,
  array[6],
  'the featured label finds featured listings'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_label => 'prime', p_limit => 120)$$,
  array[2, 4],
  'the prime label finds the expensive ones'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_label => 'budget', p_limit => 120)$$,
  array[3, 5],
  'the budget label finds the cheap ones'
);
select is(
  (select label from public.search_properties(p_limit => 120) where right(id::text, 2) = '06'),
  'featured',
  'each row carries its computed label'
);

-- Filters together
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_listing_type => 'sale', p_property_type => 'apartment', p_bhk => 2, p_max_price => 8000000, p_limit => 120)$$,
  array[1, 11, 12],
  'filters combine with and'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_listing_type => 'sale', p_locality => 'adyar', p_q => 'twin', p_limit => 120)$$,
  array[12],
  'type, locality and keyword together find one listing'
);
select is(
  (select count(*)::int from public.search_properties(p_listing_type => 'rent', p_property_type => 'villa', p_limit => 120)),
  0,
  'filters that match nothing find nothing'
);

-- Sorting, and a stable order for equal values
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'newest', p_limit => 120)),
  array[12, 11, 6, 5, 4, 3, 2, 1],
  'newest first'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_asc', p_limit => 120)),
  array[3, 4, 5, 11, 1, 12, 6, 2],
  'cheapest first, equal prices by id'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_desc', p_limit => 120)),
  array[2, 6, 12, 1, 11, 5, 4, 3],
  'dearest first, equal prices by id'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'area_desc', p_limit => 120)),
  array[2, 4, 5, 6, 1, 11, 12, 3],
  'largest first, equal areas by id'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_asc', p_limit => 120)),
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_asc', p_limit => 120)),
  'the same search gives the same order twice'
);
select is(
  (select array_agg(right(id::text, 2)::int) from public.search_properties(p_sort => 'price_asc', p_limit => 3)),
  array[3, 4, 5],
  'a short page is the start of the full order'
);
select throws_ok($$select * from public.search_properties(p_sort => 'random')$$, '22023', 'search.invalid_sort', 'an unknown sort is refused');

-- What a row holds
select ok(
  (select abs(latitude - 13.083) < 0.0000001 and abs(longitude - 80.271) < 0.0000001
   from public.search_properties(p_limit => 120) where right(id::text, 2) = '01'),
  'the position is the rounded public one (13.083, 80.271), not the exact 13.0827, 80.2707'
);
select is(
  (select cover_path from public.search_properties(p_limit => 120) where right(id::text, 2) = '11'),
  'owner/11/a.webp',
  'a listing with photos carries its cover photo'
);
select is(
  (select cover_alt from public.search_properties(p_limit => 120) where right(id::text, 2) = '11'),
  'Front of the flat',
  'and its alt text'
);
select is(
  (select cover_path from public.search_properties(p_limit => 120) where right(id::text, 2) = '01'),
  null,
  'a listing without photos has no cover'
);
select is(
  (select title from public.search_properties(p_limit => 120) where right(id::text, 2) = '06'),
  'Featured sea view flat',
  'a row carries the listing title'
);

-- Refused values
select throws_ok($$select * from public.search_properties(p_label => 'gold')$$, '22023', 'search.invalid_label', 'an unknown label is refused');
select throws_ok($$select * from public.search_properties(p_listing_type => 'lease')$$, '22023', 'search.invalid_listing_type', 'an unknown listing type is refused');
select throws_ok($$select * from public.search_properties(p_property_type => 'castle')$$, '22023', 'search.invalid_property_type', 'an unknown property type is refused');
select throws_ok($$select * from public.search_properties(p_bhk => 11)$$, '22023', 'search.invalid_bhk', 'eleven bedrooms is refused');
select throws_ok($$select * from public.search_properties(p_max_price => -1)$$, '22023', 'search.invalid_price', 'a negative price is refused');
select throws_ok($$select * from public.search_properties(p_q => repeat('a', 121))$$, '22023', 'search.invalid_keyword', 'a keyword over 120 characters is refused');
select throws_ok($$select * from public.search_properties(p_locality => repeat('a', 81))$$, '22023', 'search.invalid_locality', 'a locality text over 80 characters is refused');

reset role;

-- A signed-in owner searching still sees approved listings only, not their own drafts
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select is(
  (select count(*)::int from public.properties where id = '00000000-0000-4000-9000-000000000007'),
  1,
  'the owner can read their own draft directly'
);
select set_eq(
  $$select right(id::text, 2)::int from public.search_properties(p_limit => 120)$$,
  array[1, 2, 3, 4, 5, 6, 11, 12],
  'but the search still returns approved listings only'
);
reset role;

select * from finish();
rollback;
