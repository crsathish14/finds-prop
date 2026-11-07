-- F06 listing submit (S6-T02). Tests: DB-FN-submit_listing, DB-TRG-open-cap, DB-CHK-complete-unless-draft
-- (DEC-19 fallback), DB-PRIV-submit-functions.
begin;
select plan(36);

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now()),
  ('00000000-0000-4000-8000-0000000000a3', '919100000003', now()),
  ('00000000-0000-4000-8000-0000000000a4', '919100000004', now());

-- A complete listing, with a location unless told otherwise. The system role fills it in, so the
-- cap does not apply to the set-up.
create function pg_temp.new_listing(
  listing uuid, owner uuid, listing_status text default 'draft', with_location boolean default true
) returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address, location, rejection_reason
  ) values (
    listing, owner, listing_status, 'sale', 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road',
    case when with_location
      then extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography
    end,
    case when listing_status = 'rejected' then 'Photos are not of the home.' end
  ) returning id
$$;

create function pg_temp.add_photo(listing uuid, file text)
returns void
language sql
as $$
  insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
  values (listing, file, 'image/jpeg', 200000, 1600, 1200)
$$;

-- DEC-19 fallback: the completeness check
select lives_ok(
  $$insert into public.properties (
      id, owner_id, status, listing_type, property_type, title, price, area_sqft,
      locality, city, state, pincode, address
    ) values (
      '00000000-0000-4000-9000-0000000000f1', '00000000-0000-4000-8000-0000000000a2', 'pending',
      'sale', 'apartment', 'Flat without a pin', 5000000, 700,
      'Adyar', 'Chennai', 'Tamil Nadu', '600020', '3 Main Road'
    )$$,
  'a non-draft listing may have no location and no description'
);
select throws_ok(
  $$insert into public.properties (
      owner_id, status, listing_type, property_type, title, price, area_sqft,
      locality, city, state, pincode
    ) values (
      '00000000-0000-4000-8000-0000000000a2', 'pending',
      'sale', 'apartment', 'Flat without an address', 5000000, 700,
      'Adyar', 'Chennai', 'Tamil Nadu', '600020'
    )$$,
  '23514', null,
  'a non-draft listing still needs its address'
);
select throws_ok(
  $$insert into public.properties (
      owner_id, status, property_type, title, price, area_sqft,
      locality, city, state, pincode, address
    ) values (
      '00000000-0000-4000-8000-0000000000a2', 'pending',
      'apartment', 'Flat without a type', 5000000, 700,
      'Adyar', 'Chennai', 'Tamil Nadu', '600020', '3 Main Road'
    )$$,
  '23514', null,
  'a non-draft listing still needs its listing type'
);

-- The people
-- a1: submits listings.  a2: another owner.  a3: the cap.  a4: approved listings that do not count.
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'draft', false);
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.add_photo('00000000-0000-4000-9000-000000000001', 'a1/l1/p1.jpg');
select pg_temp.add_photo('00000000-0000-4000-9000-000000000003', 'a1/l3/p1.jpg');
select pg_temp.add_photo('00000000-0000-4000-9000-000000000004', 'a1/l4/p1.jpg');
select pg_temp.add_photo('00000000-0000-4000-9000-000000000005', 'a2/l5/p1.jpg');
-- l2 has no photo. l4 is incomplete (no title) once the title is cleared.
update public.properties set title = null where id = '00000000-0000-4000-9000-000000000004';

-- The cap's set-up: a4 has five listings that do not count
select pg_temp.new_listing('00000000-0000-4000-9000-0000000000b1', '00000000-0000-4000-8000-0000000000a4');
select pg_temp.new_listing('00000000-0000-4000-9000-0000000000b2', '00000000-0000-4000-8000-0000000000a4');
update public.properties set status = 'pending' where owner_id = '00000000-0000-4000-8000-0000000000a4';
update public.properties set status = 'approved' where owner_id = '00000000-0000-4000-8000-0000000000a4';
update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-0000000000b2';

-- Signed in as a1 (with a phone)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);

-- DB-FN-submit_listing: the happy path
select is(
  (select public.submit_listing('00000000-0000-4000-9000-000000000001')),
  (select short_id from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'submit_listing returns the short id'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'pending',
  'the listing is now pending'
);
reset role;
select ok(
  (select submitted_at is not null from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'submitted_at is stamped'
);
select is(
  (select count(*) from public.audit_log
   where entity_type = 'property' and entity_id = '00000000-0000-4000-9000-000000000001'
     and action = 'listing.status_changed' and diff ->> 'to' = 'pending')::int,
  1,
  'the move to pending is in the audit log'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);

-- A listing without a location can be submitted (DEC-19 fallback)
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000003')$$,
  'a listing with no location can be submitted'
);

-- The refusals
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000002')$$,
  '23514', 'listing.no_photo',
  'a listing with no photo is refused'
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000004')$$,
  '23514', 'listing.incomplete',
  'an incomplete listing is refused'
);
select is(
  (select 1 where exists (select 1 from public.properties where id = '00000000-0000-4000-9000-000000000004' and status = 'draft')),
  1,
  'a refused listing stays a draft'
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000001')$$,
  '55000', 'listing.not_submittable',
  'a pending listing cannot be submitted again'
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000005')$$,
  'P0002', 'listing.not_found',
  'someone else''s listing looks like one that does not exist'
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000ee')$$,
  'P0002', 'listing.not_found',
  'a listing that does not exist is refused'
);
select throws_ok(
  $$update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000002'$$,
  '42501', null,
  'a client still cannot set the status itself'
);

-- Without a verified phone
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000002')$$,
  '42501', 'listing.not_allowed',
  'an account with no verified phone is refused'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000002')$$,
  '42501', null,
  'a visitor cannot call submit_listing'
);
select throws_ok(
  $$select public.assert_open_listing_room()$$,
  '42501', null,
  'a visitor cannot call the cap check'
);
reset role;

-- A rejected listing is resubmitted (T05 uses it; the function is here)
select pg_temp.new_listing('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-0000000000a2', 'pending');
update public.properties set status = 'rejected', rejection_reason = 'Photos are not of the home.'
  where id = '00000000-0000-4000-9000-000000000006';
select pg_temp.add_photo('00000000-0000-4000-9000-000000000006', 'a2/l6/p1.jpg');
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000006')$$,
  'a rejected listing can be resubmitted'
);
select ok(
  (select status = 'pending' from public.properties where id = '00000000-0000-4000-9000-000000000006'),
  'the resubmitted listing is pending'
);
reset role;

-- DB-TRG-open-cap
-- a3 starts five drafts (the limit), the sixth is refused, deleting one makes room
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated", "phone": "919100000003"}',
  true
);
select lives_ok(
  $t$do $do$ begin
      for n in 1..5 loop
        insert into public.properties (title) values ('Draft number ' || n);
      end loop;
    end $do$$t$,
  'a person can hold five drafts'
);
select throws_ok(
  $$insert into public.properties (title) values ('The sixth draft')$$,
  'P0001', 'properties.open_limit',
  'the sixth is refused'
);
select lives_ok(
  $$delete from public.properties where title = 'Draft number 5'$$,
  'the owner deletes a draft'
);
select lives_ok(
  $$insert into public.properties (title) values ('A new sixth draft')$$,
  'there is room again after a delete'
);
reset role;

-- Pending listings count too: turn two of a3's drafts into pending ones, the cap still holds
update public.properties set status = 'pending', listing_type = 'sale', property_type = 'apartment',
  price = 5000000, area_sqft = 700, locality = 'Adyar', city = 'Chennai', state = 'Tamil Nadu',
  pincode = '600020', address = '3 Main Road'
  where owner_id = '00000000-0000-4000-8000-0000000000a3' and title in ('Draft number 1', 'Draft number 2');
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated", "phone": "919100000003"}',
  true
);
select throws_ok(
  $$insert into public.properties (title) values ('Another draft')$$,
  'P0001', 'properties.open_limit',
  'still full at five'
);
reset role;

-- Other people are not affected by a3
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select lives_ok(
  $$insert into public.properties (title) values ('Another person''s draft')$$,
  'the limit is per person'
);
reset role;

-- Approved and sold listings do not count: a4 holds two of them and starts five drafts
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a4", "role": "authenticated", "phone": "919100000004"}',
  true
);
select lives_ok(
  $t$do $do$ begin
      for n in 1..5 loop
        insert into public.properties (title) values ('Fourth person draft ' || n);
      end loop;
    end $do$$t$,
  'approved and sold listings are not in the count'
);
reset role;

-- The limit is a setting
update public.app_config set value = '6' where key = 'listings.max_open';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a4", "role": "authenticated", "phone": "919100000004"}',
  true
);
select lives_ok(
  $$insert into public.properties (title) values ('Sixth under a higher limit')$$,
  'a higher limit in app_config is honoured'
);
reset role;
update public.app_config set value = 'not a number' where key = 'listings.max_open';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a4", "role": "authenticated", "phone": "919100000004"}',
  true
);
select throws_ok(
  $$insert into public.properties (title) values ('Seventh under a broken setting')$$,
  'P0001', 'properties.open_limit',
  'a broken setting falls back to five'
);
reset role;
update public.app_config set value = '5' where key = 'listings.max_open';

-- The system is not limited: set-up and the seed insert past the limit
select lives_ok(
  $$insert into public.properties (owner_id, title)
    values ('00000000-0000-4000-8000-0000000000a3', 'A system-made draft')$$,
  'the system can insert past the limit'
);

-- A rejected listing goes back into the count when resubmitted
select pg_temp.new_listing('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-8000-0000000000a3', 'pending');
update public.properties set status = 'rejected', rejection_reason = 'Photos are not of the home.'
  where id = '00000000-0000-4000-9000-000000000007';
select pg_temp.add_photo('00000000-0000-4000-9000-000000000007', 'a3/l7/p1.jpg');
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated", "phone": "919100000003"}',
  true
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000007')$$,
  'P0001', 'properties.open_limit',
  'a rejected listing cannot be resubmitted when the person is at the limit'
);
reset role;

-- Policy C with the new fallback: adding or removing the location of an approved listing sends it back
select pg_temp.new_listing('00000000-0000-4000-9000-000000000008', '00000000-0000-4000-8000-0000000000a2', 'pending', false);
update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000008';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select lives_ok(
  $$update public.properties
    set location = extensions.st_setsrid(extensions.st_makepoint(80.25, 13.01), 4326)::extensions.geography
    where id = '00000000-0000-4000-9000-000000000008'$$,
  'an owner adds a location to an approved listing'
);
reset role;
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'pending',
  'adding a location sends the listing back to review'
);

-- Search copes with listings that have no location
update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000003';
set local role anon;
select is(
  (select count(*)::int from public.search_properties(p_q => 'apartment') where latitude is null),
  1,
  'a listing without a location appears in keyword search with no coordinates'
);
select is(
  (select count(*)::int from public.search_properties(p_lat => 13.0827, p_lng => 80.2707, p_radius_km => 50)
   where id = '00000000-0000-4000-9000-000000000003'),
  0,
  'a listing without a location is left out of radius search'
);
select is(
  (select count(*)::int from public.search_properties(p_west => 79, p_south => 12, p_east => 81, p_north => 14)
   where id = '00000000-0000-4000-9000-000000000003'),
  0,
  'a listing without a location is left out of map-box search'
);
reset role;

select * from finish();
rollback;
