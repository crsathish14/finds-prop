-- F06 enquiries and saved_properties. Tests: DB-RLS-enquiries-*, DB-TRG-enquiries-status,
-- DB-CON-enquiries, DB-RLS-saved, DB-CON-saved-unique.
begin;
select plan(32);

-- o1 owns the listings, o2 sends the enquiry, o3 is an unrelated customer.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now()),
  ('00000000-0000-4000-8000-0000000000a3', '919100000003', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

create function pg_temp.new_listing(listing uuid, owner uuid, listing_status text default 'approved')
returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address, location
  ) values (
    listing, owner, listing_status, 'sale', 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road',
    extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography
  ) returning id
$$;

select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'draft');

insert into public.enquiries (id, property_id, user_id, name, phone, status_changed_at)
values (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-9000-000000000001',
  '00000000-0000-4000-8000-0000000000a2',
  'Priya',
  '9876543210',
  '2000-01-01'
);

-- DB-CON-enquiries
select throws_ok(
  $$insert into public.enquiries (property_id, name, phone)
    values ('00000000-0000-4000-9000-000000000001', 'Priya', 'abc')$$,
  '23514',
  null,
  'a phone number is 6 to 15 digits'
);
select throws_ok(
  $$insert into public.enquiries (property_id, name, phone)
    values ('00000000-0000-4000-9000-000000000001', 'P', '9876543210')$$,
  '23514',
  null,
  'a name is at least 2 characters'
);
select throws_ok(
  $$insert into public.enquiries (property_id, name, phone, message)
    values ('00000000-0000-4000-9000-000000000001', 'Priya', '9876543210', repeat('x', 1001))$$,
  '23514',
  null,
  'a message is at most 1000 characters'
);

-- Visitors
set local role anon;
select throws_ok($$select * from public.enquiries$$, '42501', null, 'anon cannot read enquiries');
select throws_ok($$select * from public.saved_properties$$, '42501', null, 'anon cannot read saved homes');
reset role;

-- The sender, o2
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select throws_ok(
  $$insert into public.enquiries (property_id, user_id, name, phone)
    values ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a2', 'Priya', '9876543210')$$,
  '42501',
  null,
  'BR-50: a client cannot insert an enquiry directly'
);
select is((select count(*) from public.enquiries)::int, 1, 'BR-51: the sender sees their enquiry');
select lives_ok(
  $$update public.enquiries set status = 'closed' where id = '00000000-0000-4000-a000-000000000001'$$,
  'a sender update is accepted but matches no rows'
);

-- Saved homes, o2
select lives_ok(
  $$insert into public.saved_properties (property_id) values ('00000000-0000-4000-9000-000000000001')$$,
  'BR-53: a signed-in customer can save an approved listing'
);
select throws_ok(
  $$insert into public.saved_properties (property_id) values ('00000000-0000-4000-9000-000000000001')$$,
  '23505',
  null,
  'BR-53: a home can be saved once'
);
select throws_ok(
  $$insert into public.saved_properties (property_id) values ('00000000-0000-4000-9000-000000000002')$$,
  '42501',
  null,
  'a listing that is not approved cannot be saved'
);
select throws_ok(
  $$insert into public.saved_properties (user_id, property_id)
    values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-9000-000000000001')$$,
  '42501',
  null,
  'a client cannot save on behalf of another user'
);
select is((select count(*) from public.saved_properties)::int, 1, 'a customer sees their own saved homes');
reset role;
select is(
  (select status from public.enquiries where id = '00000000-0000-4000-a000-000000000001'),
  'new',
  'the sender could not change the enquiry'
);

-- The listing owner, o1
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select is((select count(*) from public.enquiries)::int, 1, 'BR-51: the listing owner sees the enquiry');
select lives_ok(
  $$update public.enquiries set status = 'contacted' where id = '00000000-0000-4000-a000-000000000001'$$,
  'BR-52: the owner can mark an enquiry contacted'
);
select ok(
  (select status_changed_at > '2000-01-01'::timestamptz from public.enquiries
   where id = '00000000-0000-4000-a000-000000000001'),
  'changing the status refreshes status_changed_at'
);
select throws_ok(
  $$update public.enquiries set status = 'new' where id = '00000000-0000-4000-a000-000000000001'$$,
  'P0001',
  'enquiries.status_transition',
  'BR-52: the status cannot go backward'
);
select lives_ok(
  $$update public.enquiries set status = 'closed' where id = '00000000-0000-4000-a000-000000000001'$$,
  'BR-52: the owner can close an enquiry'
);
select throws_ok(
  $$update public.enquiries set status = 'contacted' where id = '00000000-0000-4000-a000-000000000001'$$,
  'P0001',
  'enquiries.status_transition',
  'a closed enquiry cannot be reopened'
);
select throws_ok(
  $$update public.enquiries set message = 'changed' where id = '00000000-0000-4000-a000-000000000001'$$,
  '42501',
  null,
  'the owner can change only the status'
);
select is((select count(*) from public.saved_properties)::int, 0, 'saved homes are private to the user');

-- Another customer, o3
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated", "phone": "919100000003"}',
  true
);
select is((select count(*) from public.enquiries)::int, 0, 'an unrelated customer sees no enquiries');
select lives_ok(
  $$delete from public.saved_properties$$,
  'deleting another user''s saved homes is accepted but matches no rows'
);

-- Without a verified phone nothing can be saved
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated"}',
  true
);
select throws_ok(
  $$insert into public.saved_properties (property_id) values ('00000000-0000-4000-9000-000000000001')$$,
  '42501',
  null,
  'BR-54: saving needs a verified phone'
);
reset role;
select is(
  (select count(*) from public.saved_properties)::int,
  1,
  'the other user''s saved home still exists'
);

-- The admin
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select cmp_ok((select count(*) from public.enquiries)::int, '>=', 1, 'the admin sees every enquiry');
select cmp_ok((select count(*) from public.saved_properties)::int, '>=', 1, 'the admin sees every saved home');
reset role;

-- The owner may delete their own saved home
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select lives_ok($$delete from public.saved_properties$$, 'a customer can remove a saved home');
reset role;
select is((select count(*) from public.saved_properties)::int, 0, 'the saved home is gone');

-- Defence in depth: the guard refuses if a grant were ever widened
grant update (message) on public.enquiries to authenticated;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select throws_ok(
  $$update public.enquiries set message = 'changed' where id = '00000000-0000-4000-a000-000000000001'$$,
  'P0001',
  'enquiries.immutable_columns',
  'the guard refuses a change to anything but the status'
);
reset role;

-- Deleting the sender keeps the enquiry for the owner
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a2';
select ok(
  (select user_id is null from public.enquiries where id = '00000000-0000-4000-a000-000000000001'),
  'deleting the sender keeps the enquiry with no user'
);

select * from finish();
rollback;
