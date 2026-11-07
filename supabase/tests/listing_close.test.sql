-- F06 listing close (S6-T03). Tests: DB-FN-close_listing, DB-PRIV-close-listing, DB-AUDIT-close.
begin;
select plan(16);

-- a1 owns the listings, a2 is another owner.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());

-- A complete listing in the given state. The system role fills it in, so the owner rules do not
-- apply to the set-up.
create function pg_temp.new_listing(
  listing uuid, owner uuid, listing_status text default 'approved', kind text default 'sale'
) returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address
  ) values (
    listing, owner, listing_status, kind, 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road'
  ) returning id
$$;

-- l1 approved sale (featured), l2 approved rent, l3 pending, l5 someone else's, l8 approved sale,
-- l9 approved rent, l10 approved sale.
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'approved', 'rent');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'pending');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000008', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000009', '00000000-0000-4000-8000-0000000000a1', 'approved', 'rent');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000010', '00000000-0000-4000-8000-0000000000a1');
update public.properties set featured = true where id = '00000000-0000-4000-9000-000000000001';

-- Signed in as a1 (with a phone)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);

-- DB-FN-close_listing: the happy paths
select is(
  (select status from public.close_listing('00000000-0000-4000-9000-000000000001', 'sold')),
  'sold',
  'a sale listing is marked sold'
);
select is(
  (select status from public.close_listing('00000000-0000-4000-9000-000000000002', 'rented')),
  'rented',
  'a rent listing is marked rented'
);
reset role;
select ok(
  (select closed_at is not null and not featured from public.properties
   where id = '00000000-0000-4000-9000-000000000001'),
  'closed_at is stamped and the listing is no longer featured'
);
-- DB-AUDIT-close: recorded, with the owner as the actor
select is(
  (select count(*) from public.audit_log
   where entity_type = 'property' and entity_id = '00000000-0000-4000-9000-000000000001'
     and action = 'listing.status_changed' and actor_role = 'customer'
     and actor_id = '00000000-0000-4000-8000-0000000000a1'
     and diff ->> 'from' = 'approved' and diff ->> 'to' = 'sold')::int,
  1,
  'the change is in the audit log with the owner as the actor'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select is(
  (select short_id from public.close_listing('00000000-0000-4000-9000-000000000008', 'sold')),
  (select short_id from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'it returns the short id, for the cache tags'
);

-- The refusals
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000009', 'sold')$$,
  '22023', 'listing.wrong_outcome',
  'a rent listing cannot be marked sold'
);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000010', 'rented')$$,
  '22023', 'listing.wrong_outcome',
  'a sale listing cannot be marked rented'
);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000003', 'sold')$$,
  '55000', 'listing.not_closable',
  'a pending listing cannot be closed'
);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000001', 'sold')$$,
  '55000', 'listing.not_closable',
  'a listing that is already sold cannot be closed again'
);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000005', 'sold')$$,
  'P0002', 'listing.not_found',
  'someone else''s listing looks like one that does not exist'
);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-0000000000ee', 'sold')$$,
  'P0002', 'listing.not_found',
  'a listing that does not exist is refused'
);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000010', 'gone')$$,
  '22023', 'listing.bad_outcome',
  'an outcome other than sold or rented is refused'
);
select is(
  (select count(*) from public.properties
   where id in (
     '00000000-0000-4000-9000-000000000003', '00000000-0000-4000-9000-000000000009',
     '00000000-0000-4000-9000-000000000010'
   ) and status in ('pending', 'approved'))::int,
  3,
  'every refused call left its listing as it was'
);
select throws_ok(
  $$update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-000000000010'$$,
  '42501', null,
  'a client still cannot set the status itself'
);

-- DB-PRIV-close-listing: without a verified phone, and as a visitor
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000010', 'sold')$$,
  '42501', 'listing.not_allowed',
  'an account with no verified phone is refused'
);
reset role;
set local role anon;
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000010', 'sold')$$,
  '42501', null,
  'a visitor cannot call close_listing'
);
reset role;

select * from finish();
rollback;
