-- AI chat for guests: guest_search_properties() is for the server only. Tests: DB-FN-guest-search (BR-90, ADR-171).
-- It gives approved homes only, at most 10 at a time, and the public card columns; visitors who are not signed in and
-- signed-in people cannot run it with their own keys (only service_role can). Fictional data only.
begin;
select plan(7);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());
create function pg_temp.home(n integer, listing_status text default 'approved')
returns void
language sql
as $$
  insert into public.properties (
    id, short_id, owner_id, status, listing_type, property_type, bhk, title, description, price,
    area_sqft, locality, city, state, pincode, address, location, published_at
  ) values (
    ('00000000-0000-4000-9000-0000000000' || lpad(n::text, 2, '0'))::uuid,
    'gggggg' || substr('abcdefghjkmnpqrstuvwxyz', n, 1) || '2',
    '00000000-0000-4000-8000-0000000000a1', listing_status, 'sale', 'apartment', 2,
    'Guest search home ' || n, 'A made-up home.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu', '600020',
    '12 Beach Road',
    extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography,
    '2026-01-01'::timestamptz + make_interval(days => n)
  )
$$;
select pg_temp.home(n) from generate_series(1, 14) as n;
select pg_temp.home(15, 'pending');

set local role service_role;

select is(
  (select count(*)::int from public.guest_search_properties(p_limit => 50)),
  10,
  'the server gets at most ten homes in one call, whatever limit it asks for'
);
select is(
  (select count(*)::int from public.guest_search_properties(p_locality => 'Adyar', p_limit => 3)),
  3,
  'it keeps a smaller limit'
);
select is(
  (select max(total_count)::int from public.guest_search_properties(p_limit => 5)),
  14,
  'it counts the approved homes only: the home waiting for review is not there'
);
select ok(
  not exists (
    select 1 from public.guest_search_properties(p_limit => 10) as found
    where to_jsonb(found) ?| array['owner_id', 'address', 'location', 'status', 'rejection_reason', 'description']
  ),
  'it gives no owner, address, exact point, status, review note or description'
);

set local role anon;
select throws_ok(
  $$select * from public.guest_search_properties()$$,
  '42501', null, 'a visitor with the public key cannot run it'
);
set local role authenticated;
select throws_ok(
  $$select * from public.guest_search_properties()$$,
  '42501', null, 'a signed-in person with their own key cannot run it either'
);
reset role;
select ok(
  has_function_privilege('service_role',
    'public.guest_search_properties(text, text, integer, bigint, bigint, text, double precision, double precision, double precision, double precision, double precision, double precision, double precision, text, text, text, integer, text)',
    'EXECUTE'),
  'only the server role may run it'
);

select * from finish();
rollback;
