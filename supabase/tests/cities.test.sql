-- Header city selector, part 1: the cities table, its trigger, listed_cities() and the p_city filter.
-- Tests: DB-FN-cities (BR-90, BR-91). Fictional listings only.
begin;
select plan(16);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000c1', '919100000011', now());

create function pg_temp.add_home(n integer, listing_status text, town text, place text)
returns void
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, bhk, title, description, price, area_sqft,
    locality, city, state, pincode, address, location, published_at
  ) values (
    ('00000000-0000-4000-9000-0000000001' || lpad(n::text, 2, '0'))::uuid,
    '00000000-0000-4000-8000-0000000000c1', listing_status, 'sale', 'apartment', 2, 'Fictional home',
    'A fictional listing for the city tests.', 5000000, 900, place, town, 'Tamil Nadu', '600020',
    '1 Test Road', extensions.st_setsrid(extensions.st_makepoint(80.27, 13.08), 4326)::extensions.geography,
    '2026-01-01'::timestamptz + make_interval(days => n)
  )
$$;

-- The key makes spellings the same city
select is(public.city_key('  Chennai. '), 'chennai', 'the key drops case, spaces and dots');
select is(public.city_key('Tiru-chirappalli'), 'tiruchirappalli', 'the key drops hyphens');
select is(public.city_key('  '), null, 'a blank name has no key');
select is(public.city_display_name('  coimbatore   city '), 'Coimbatore City', 'the display name is tidy');

-- The table after the migration holds Chennai (the default city)
select is((select name from public.cities where key = 'chennai'), 'Chennai', 'Chennai is always in the table');

-- Writing a listing adds only the city
select pg_temp.add_home(1, 'approved', 'coimbatore', 'Gandhipuram');
select pg_temp.add_home(2, 'approved', 'Coimbatore ', 'RS Puram');
select pg_temp.add_home(3, 'draft', 'Madurei', 'Anna Nagar');
select pg_temp.add_home(4, 'approved', 'Chennai', 'Adyar');
select is((select count(*) from public.cities where key = 'coimbatore'), 1::bigint, 'two spellings of one city make one row');
select is((select name from public.cities where key = 'coimbatore'), 'Coimbatore', 'the first spelling, tidied, is the name');
select is((select state from public.cities where key = 'coimbatore'), 'Tamil Nadu', 'the state is kept');
select ok(exists (select 1 from public.cities where key = 'madurei'), 'a draft adds its city too');
select is(
  (select count(*) from public.cities where key in ('gandhipuram', 'rspuram', 'adyar', 'annanagar')),
  0::bigint,
  'a locality is never added as a city'
);

-- Visitors: the dropdown list and the filter
set local role anon;
select is(
  (select array_agg(key order by key) from public.listed_cities() where key in ('coimbatore', 'madurei', 'chennai')),
  array['chennai', 'coimbatore'],
  'only cities with an approved listing are listed (a draft-only city is not)'
);
select is(
  (select listing_count from public.listed_cities() where key = 'coimbatore'),
  2::bigint,
  'the count is the approved listings of the city'
);
select is(
  (select count(*) from public.search_properties(p_city => 'coimbatore', p_limit => 120)),
  2::bigint,
  'the city filter keeps only that city'
);
select is(
  (select count(*) from public.search_properties(p_city => ' Chennai.', p_limit => 120)),
  (select count(*) from public.search_properties(p_city => 'chennai', p_limit => 120)),
  'the filter takes any spelling of the key'
);
select throws_ok(
  $$select * from public.search_properties(p_city => '!!')$$, '22023', 'search.invalid_city', 'a city with no letters is refused'
);
select throws_ok($$insert into public.cities (key, name) values ('hack', 'Hack')$$, '42501', null, 'a visitor cannot write a city');

reset role;
select * from finish();
rollback;
