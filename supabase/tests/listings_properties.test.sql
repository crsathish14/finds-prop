-- F06 properties. Tests: DB-TRG-properties-*, DB-CON-properties, DB-RLS-properties-*,
-- DB-RLS-column-grants, DB-FN-my_properties, DB-FN-admin_properties.
begin;
select plan(72);

-- Users: o1 and o2 sign in by phone, ad is the reserved admin.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

-- A complete listing, inserted as the system (these tests run as the database owner).
create function pg_temp.new_listing(
  listing uuid,
  owner uuid,
  listing_status text default 'approved',
  property_kind text default 'apartment',
  bedrooms smallint default null,
  is_featured boolean default false,
  listing_title text default 'Sea view apartment'
) returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, featured, listing_type, property_type, bhk, title, description, price,
    area_sqft, locality, city, state, pincode, address, location
  ) values (
    listing, owner, listing_status, is_featured, 'sale', property_kind, bedrooms, listing_title,
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road',
    extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography
  ) returning id
$$;

select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a1', 'draft');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a1', 'pending');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-8000-0000000000a1', 'approved', 'apartment', null, true);
select pg_temp.new_listing('00000000-0000-4000-9000-000000000008', '00000000-0000-4000-8000-0000000000a1', 'draft');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000009', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000010', '00000000-0000-4000-8000-0000000000a1');

-- Identity: short id, slug, rounded public location
select ok(
  (select short_id ~ '^[a-hjkmnp-z2-9]{8}$' from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'a short id of 8 unambiguous characters is generated'
);
select is(
  (select slug from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'sea-view-apartment-adyar',
  'the slug is built from the title and locality'
);
select is(public.slugify('  Hello, World!  '), 'hello-world', 'slugify keeps lower case words');
select is(public.build_property_slug(null, null), 'property', 'an empty title and locality gives a fallback slug');
select ok(
  (select extensions.st_distance(location, public_location) between 1 and 100
   from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'the public location is a different point, within 100 m of the exact one'
);
update public.properties set title = 'Garden villa' where id = '00000000-0000-4000-9000-000000000005';
select is(
  (select slug from public.properties where id = '00000000-0000-4000-9000-000000000005'),
  'garden-villa-adyar',
  'changing the title rebuilds the slug'
);
select throws_ok(
  $$update public.properties set short_id = 'abcdefgh' where id = '00000000-0000-4000-9000-000000000001'$$,
  'P0001',
  'properties.short_id_immutable',
  'the short id never changes'
);

-- DB-CON-properties
select throws_ok(
  $$insert into public.properties (owner_id, status, title)
    values ('00000000-0000-4000-8000-0000000000a1', 'pending', 'Just a title')$$,
  '23514',
  null,
  'a listing that is not a draft must be complete'
);
select lives_ok(
  $$insert into public.properties (owner_id) values ('00000000-0000-4000-8000-0000000000a1')$$,
  'a draft may be empty'
);
select throws_ok(
  $$select pg_temp.new_listing('00000000-0000-4000-9000-000000000099', '00000000-0000-4000-8000-0000000000a1', 'approved', 'plot', 2::smallint)$$,
  '23514',
  null,
  'a plot has no BHK'
);
select throws_ok(
  $$select pg_temp.new_listing('00000000-0000-4000-9000-000000000099', '00000000-0000-4000-8000-0000000000a1', 'pending', 'apartment', null, true)$$,
  '23514',
  null,
  'only an approved listing can be featured'
);
select throws_ok(
  $$update public.properties set status = 'rejected' where id = '00000000-0000-4000-9000-000000000005'$$,
  '23514',
  null,
  'a rejection needs a reason'
);

-- DB-TRG-properties: ownership and the status machine (BR-20 to BR-25)
select throws_ok(
  $$update public.properties set owner_id = '00000000-0000-4000-8000-0000000000a2' where id = '00000000-0000-4000-9000-000000000001'$$,
  'P0001',
  'properties.owner_immutable',
  'BR-23: the owner never changes'
);
select throws_ok(
  $$update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000008'$$,
  'P0001',
  'properties.status_transition',
  'a draft cannot jump to approved'
);
select lives_ok(
  $$update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000008'$$,
  'draft to pending is allowed'
);
select ok(
  (select submitted_at is not null from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'submitting stamps submitted_at'
);
select lives_ok(
  $$update public.properties set status = 'rejected', rejection_reason = 'Photos unclear'
    where id = '00000000-0000-4000-9000-000000000008'$$,
  'pending to rejected with a reason is allowed'
);
select lives_ok(
  $$update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000008'$$,
  'rejected to pending is allowed'
);
select ok(
  (select rejection_reason is null from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'resubmitting clears the rejection reason'
);
select lives_ok(
  $$update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000008'$$,
  'pending to approved is allowed'
);
select ok(
  (select published_at is not null from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'approving stamps published_at'
);
select throws_ok(
  $$update public.properties set status = 'draft' where id = '00000000-0000-4000-9000-000000000008'$$,
  'P0001',
  'properties.status_transition',
  'an approved listing cannot go back to draft'
);
select lives_ok(
  $$update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-000000000008'$$,
  'approved to sold is allowed'
);
select ok(
  (select closed_at is not null and not featured from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'closing stamps closed_at'
);
select throws_ok(
  $$update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000008'$$,
  'P0001',
  'properties.status_transition',
  'a sold listing is final'
);

-- Visitors (guests): DB-RLS-properties-anon, DB-RLS-column-grants (ADR-017)
set local role anon;
select is(
  (select count(*) from public.properties)::int,
  7,
  'anon sees only the approved listings'
);
select lives_ok(
  $$select public_location, slug, short_id, title, price from public.properties$$,
  'anon can read the public columns'
);
select throws_ok($$select owner_id from public.properties$$, '42501', null, 'anon cannot read owner_id');
select throws_ok($$select address from public.properties$$, '42501', null, 'anon cannot read the address');
select throws_ok($$select location from public.properties$$, '42501', null, 'anon cannot read the exact location');
select throws_ok(
  $$select rejection_reason from public.properties$$,
  '42501',
  null,
  'anon cannot read the rejection reason'
);
select throws_ok($$select * from public.properties$$, '42501', null, 'anon cannot select every column');
select throws_ok(
  $$insert into public.properties (title) values ('Anonymous listing')$$,
  '42501',
  null,
  'anon cannot insert'
);
reset role;

-- The owner, o1 (signed in with a phone)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select ok(
  exists (select 1 from public.properties where id = '00000000-0000-4000-9000-000000000005'),
  'an owner sees their own pending listing'
);
select lives_ok(
  $$insert into public.properties (title) values ('My first draft')$$,
  'an owner can start a draft'
);
select throws_ok(
  $$insert into public.properties (owner_id, title)
    values ('00000000-0000-4000-8000-0000000000a2', 'Someone else''s draft')$$,
  '42501',
  null,
  'a client cannot choose the owner'
);
select throws_ok(
  $$insert into public.properties (status, title) values ('approved', 'Self approved')$$,
  '42501',
  null,
  'a client cannot choose the status'
);
select lives_ok(
  $$update public.properties set price = 9000000 where id = '00000000-0000-4000-9000-000000000001'$$,
  'an owner can change the price'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'approved',
  'DEC-09: a price change keeps the listing approved'
);
select lives_ok(
  $$update public.properties set title = 'Sea view apartment, renovated'
    where id = '00000000-0000-4000-9000-000000000002'$$,
  'an owner can change the title'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000002'),
  'pending',
  'DEC-09: a title change sends an approved listing back to review'
);
select lives_ok(
  $$update public.properties set address = '14 Beach Road' where id = '00000000-0000-4000-9000-000000000003'$$,
  'an owner can change the address'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000003'),
  'pending',
  'DEC-09: an address change sends an approved listing back to review'
);
select lives_ok(
  $$update public.properties
    set location = extensions.st_setsrid(extensions.st_makepoint(80.3, 13.1), 4326)::extensions.geography
    where id = '00000000-0000-4000-9000-000000000009'$$,
  'an owner can move the location'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000009'),
  'pending',
  'DEC-09: a location change sends an approved listing back to review'
);
select lives_ok(
  $$update public.properties set description = 'Now with a roof terrace.'
    where id = '00000000-0000-4000-9000-000000000007'$$,
  'an owner can change the description of a featured listing'
);
select ok(
  (select status = 'pending' and not featured from public.properties where id = '00000000-0000-4000-9000-000000000007'),
  'a moderated edit also removes the featured flag'
);
select throws_ok(
  $$update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-000000000004'$$,
  '42501',
  null,
  'a client cannot change the status'
);
select throws_ok(
  $$update public.properties set featured = true where id = '00000000-0000-4000-9000-000000000001'$$,
  '42501',
  null,
  'BR-25: a client cannot feature a listing'
);
select throws_ok(
  $$update public.properties set owner_id = '00000000-0000-4000-8000-0000000000a2'
    where id = '00000000-0000-4000-9000-000000000001'$$,
  '42501',
  null,
  'a client cannot change the owner'
);

-- Without a verified phone the owner cannot create a listing
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}',
  true
);
select throws_ok(
  $$insert into public.properties (title) values ('No phone draft')$$,
  '42501',
  null,
  'creating a listing needs a verified phone'
);
reset role;

select ok(
  exists (
    select 1 from public.properties
    where title = 'My first draft' and status = 'draft'
      and owner_id = '00000000-0000-4000-8000-0000000000a1'
  ),
  'the new draft belongs to the signed-in user and starts as a draft'
);

-- A sold listing is final for the owner
update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-000000000010';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select throws_ok(
  $$update public.properties set price = 1 where id = '00000000-0000-4000-9000-000000000010'$$,
  'P0001',
  'properties.terminal_status',
  'an owner cannot edit a sold listing'
);

-- Functions that return complete rows
select ok(
  (select count(*) > 0 and bool_and(owner_id = '00000000-0000-4000-8000-0000000000a1') from public.my_properties()),
  'my_properties returns only the caller''s listings'
);
select ok(
  (select count(*) > 0 from public.my_properties() where address is not null),
  'my_properties includes the private address'
);
select is((select count(*) from public.admin_properties())::int, 0, 'admin_properties is empty for a customer');

-- Another customer, o2
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select ok(
  not exists (select 1 from public.properties where id = '00000000-0000-4000-9000-000000000005'),
  'another customer cannot see a pending listing'
);
select ok(
  not exists (select 1 from public.my_properties() where id = '00000000-0000-4000-9000-000000000001'),
  'my_properties does not return another owner''s listing'
);
select lives_ok(
  $$update public.properties set price = 1 where id = '00000000-0000-4000-9000-000000000001'$$,
  'updating another owner''s listing is accepted but matches no rows'
);
select lives_ok(
  $$delete from public.properties where id = '00000000-0000-4000-9000-000000000001'$$,
  'deleting another owner''s listing is accepted but matches no rows'
);
reset role;
select ok(
  (select price = 9000000 from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'the other owner''s price is unchanged and the listing still exists'
);

-- The owner deletes their own listing (BR-26)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select lives_ok(
  $$delete from public.properties where id = '00000000-0000-4000-9000-000000000004'$$,
  'an owner can delete their own listing'
);
reset role;
select ok(
  not exists (select 1 from public.properties where id = '00000000-0000-4000-9000-000000000004'),
  'BR-26: the deleted listing is gone'
);

-- The admin
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select ok(
  exists (select 1 from public.properties where id = '00000000-0000-4000-9000-000000000005'),
  'the admin sees a pending listing'
);
select cmp_ok(
  (select count(*) from public.admin_properties())::int,
  '>=',
  8,
  'admin_properties returns every listing'
);
reset role;
select ok(
  not has_function_privilege('anon', 'public.my_properties()', 'execute'),
  'anon cannot execute my_properties'
);

-- Defence in depth: the guard still refuses if a grant were ever widened
grant update (status, featured, rejection_reason, owner_id) on public.properties to authenticated;
grant insert (status, owner_id) on public.properties to authenticated;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select throws_ok(
  $$update public.properties set status = 'rejected' where id = '00000000-0000-4000-9000-000000000005'$$,
  'P0001',
  'properties.status_system_only',
  'the guard refuses a user status change'
);
select throws_ok(
  $$update public.properties set featured = true where id = '00000000-0000-4000-9000-000000000001'$$,
  'P0001',
  'properties.admin_only_columns',
  'the guard refuses a user featuring a listing'
);
select throws_ok(
  $$update public.properties set rejection_reason = 'x' where id = '00000000-0000-4000-9000-000000000005'$$,
  'P0001',
  'properties.admin_only_columns',
  'the guard refuses a user writing moderation columns'
);
select throws_ok(
  $$update public.properties set owner_id = '00000000-0000-4000-8000-0000000000a2'
    where id = '00000000-0000-4000-9000-000000000001'$$,
  'P0001',
  'properties.owner_immutable',
  'the guard refuses an owner change'
);
select throws_ok(
  $$insert into public.properties (status, title) values ('approved', 'Self approved')$$,
  'P0001',
  'properties.initial_values',
  'BR-20: the guard refuses a user inserting a non-draft listing'
);
select throws_ok(
  $$insert into public.properties (owner_id, title)
    values ('00000000-0000-4000-8000-0000000000a2', 'Someone else''s draft')$$,
  'P0001',
  'properties.initial_values',
  'the guard refuses a user inserting for another owner'
);
reset role;

select * from finish();
rollback;
