-- DEC-08 (S6-T06): the `agent` role exists in the enum but grants nothing. A user who holds it is exactly a
-- customer: no moderation, no extra reading, no say over other people's listings or roles, and every
-- customer ability intact. Tests: DB-RLS-agent-has-no-extra-access.
begin;
select plan(16);

-- ag holds the agent role on top of the customer role every account gets, and has a verified phone, so the
-- customer abilities apply; a2 is an ordinary customer who owns the other listings.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'agent');

-- A complete listing in the given state, made by the system so the owner rules do not apply to the set-up.
create function pg_temp.new_listing(listing uuid, owner uuid, listing_status text) returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address
  ) values (
    listing, owner, listing_status, 'sale', 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road'
  ) returning id
$$;

-- l1 and l2 are the customer's (pending and approved), l3 and l4 are the agent's own (pending and approved).
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a2', 'pending');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a2', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'pending');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a1', 'approved');
-- e1 is an enquiry on the customer's listing, e2 on the agent's own.
insert into public.enquiries (id, property_id, name, phone) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-9000-000000000002', 'Arjun Menon', '9841055512'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-9000-000000000004', 'Divya Krishnan', '9884021098');

select is(
  (select array_agg(role::text order by role::text) from public.user_roles
   where user_id = '00000000-0000-4000-8000-0000000000a1'),
  array['agent', 'customer'], 'the agent holds the agent role next to the customer role every account has'
);

-- Signed in as the agent
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);

-- No moderation
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'approve')$$,
  '42501', 'listing.not_allowed', 'an agent cannot approve a listing'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000003', 'approve')$$,
  '42501', 'listing.not_allowed', 'an agent cannot approve their own listing either'
);
select throws_ok($$select * from public.admin_listing_queue()$$, '42501', 'listing.not_allowed', 'an agent cannot read the moderation queue');
select throws_ok($$select * from public.admin_listing_counts()$$, '42501', 'listing.not_allowed', 'an agent cannot read the queue counts');
select is(
  (select count(*) from public.admin_properties())::int, 0, 'an agent cannot read every listing'
);

-- No extra reading: only what a customer reads
select is(
  (select count(*) from public.properties where id = '00000000-0000-4000-9000-000000000001')::int,
  0, 'an agent cannot see another owner''s pending listing'
);
select is(
  (select count(*) from public.properties where id = '00000000-0000-4000-9000-000000000002')::int,
  1, 'an agent sees what the public sees: an approved listing'
);
select is(
  (select array_agg(id order by id) from public.my_properties()),
  array['00000000-0000-4000-9000-000000000003'::uuid, '00000000-0000-4000-9000-000000000004'::uuid],
  'my_properties returns only the agent''s own listings'
);
select is(
  (select array_agg(id order by id) from public.enquiries),
  array['00000000-0000-4000-a000-000000000002'::uuid],
  'an agent reads only the enquiries on their own listings'
);
select is(
  (select count(*) from public.user_roles)::int, 2, 'an agent reads only their own two role rows'
);

-- No say over other people's listings or over roles
update public.properties set title = 'Taken over by an agent' where id = '00000000-0000-4000-9000-000000000002';
delete from public.properties where id = '00000000-0000-4000-9000-000000000002';
select throws_ok(
  $$select * from public.close_listing('00000000-0000-4000-9000-000000000002', 'sold')$$,
  'P0002', 'listing.not_found', 'an agent cannot close another owner''s listing'
);
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a1', 'builder')$$,
  '42501', null, 'an agent cannot give themselves another role'
);

-- Every customer ability is intact
select lives_ok(
  $$insert into public.properties (title) values ('A draft from an agent')$$,
  'an agent can start a draft like any customer'
);
select is(
  (select status from public.close_listing('00000000-0000-4000-9000-000000000004', 'sold')),
  'sold', 'an agent can mark their own Live listing sold'
);
reset role;

-- And nothing of the above changed the customer's listing
select is(
  (select title from public.properties where id = '00000000-0000-4000-9000-000000000002'),
  'Sea view apartment', 'the other owner''s listing is untouched (updated and deleted by nobody)'
);

select * from finish();
rollback;
