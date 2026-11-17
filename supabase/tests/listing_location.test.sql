-- Place search PR 7a (ADR-138): set_listing_location and the location rule of submit_listing.
-- Tests: DB-FN-set_listing_location, DB-FN-submit_listing (location required), DB-RULE-policy-C-location,
-- DB-PRIV-set_listing_location, DB-PRIV-exact-location (FR-GEO-03, ADR-060, DEC-09, DEC-35).
-- Fictional listings only. Listing n has the id ...0000000000nn.
--   1 draft, no location (a1)             2 pending, no location (a1)        3 approved, with location (a1)
--   4 approved, no location (a1, legacy)  5 rejected (a1)                    6 sold (a1)
--   7 draft (a2)                          8 draft with a photo, no location (a1)
--   9 approved (a2)                      10 approved, no location (a2, legacy)
--  11 approved, exact point 80.270741, 13.082741 (a2)                       12 rejected with a photo, no location (a1)
-- The region is the seed's Tamil Nadu box: south 8.0, north 13.6, west 76.2, east 80.4.
begin;
select plan(53);

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());

insert into public.site_settings (key, value)
values (
  'region',
  jsonb_build_object(
    'name', 'Tamil Nadu',
    'bounds', jsonb_build_object('south', 8.0, 'west', 76.2, 'north', 13.6, 'east', 80.4)
  )
)
on conflict (key) do update set value = excluded.value;

-- A complete listing. The system role fills it in, so the cap and the lifecycle guard do not apply to the
-- set-up. A listing with a location has the point 80.2707, 13.0827 unless told otherwise.
create function pg_temp.new_listing(
  listing uuid,
  owner uuid,
  listing_status text default 'draft',
  lng double precision default null,
  lat double precision default null
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
    case when lng is not null and lat is not null
      then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
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

select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'pending');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'approved', 80.2707, 13.0827);
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a1', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a1', 'rejected');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-0000000000a1', 'sold', 80.2707, 13.0827);
select pg_temp.new_listing('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000008', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000009', '00000000-0000-4000-8000-0000000000a2', 'approved', 80.2707, 13.0827);
select pg_temp.new_listing('00000000-0000-4000-9000-000000000010', '00000000-0000-4000-8000-0000000000a2', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-8000-0000000000a2', 'approved', 80.270741, 13.082741);
select pg_temp.new_listing('00000000-0000-4000-9000-000000000012', '00000000-0000-4000-8000-0000000000a1', 'rejected');
select pg_temp.add_photo('00000000-0000-4000-9000-000000000008', 'a1/l8/p1.jpg');
select pg_temp.add_photo('00000000-0000-4000-9000-000000000012', 'a1/l12/p1.jpg');

-- How the function is built (DB-PRIV-set_listing_location)
select ok(
  (select not prosecdef and coalesce(proconfig::text like '%search_path=%', false)
   from pg_proc
   where proname = 'set_listing_location' and pronamespace = 'public'::regnamespace),
  'set_listing_location runs as the caller (no definer rights) and pins its search_path'
);
select is(
  has_function_privilege('anon', 'public.set_listing_location(uuid, double precision, double precision)', 'EXECUTE'),
  false,
  'a visitor cannot execute set_listing_location'
);
select is(
  has_function_privilege('authenticated', 'public.set_listing_location(uuid, double precision, double precision)', 'EXECUTE'),
  true,
  'a signed-in person can execute set_listing_location'
);
select is(
  has_function_privilege('service_role', 'public.set_listing_location(uuid, double precision, double precision)', 'EXECUTE'),
  false,
  'the service role has no use for it and cannot execute it'
);

-- Signed in as a1 (with a phone)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);

-- The owner sets a location on a draft; the function says the listing is still a draft
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000001', 13.0827, 80.2707)),
  'draft',
  'the owner sets a location on a draft and the listing stays a draft'
);

-- A point that is not a place is refused
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', null, 80.2707)$$,
  '22023', 'listing.location_invalid', 'a missing latitude is refused'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 13.0827, null)$$,
  '22023', 'listing.location_invalid', 'a missing longitude is refused'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 91, 80.2707)$$,
  '22023', 'listing.location_invalid', 'a latitude above 90 is refused'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', -90.01, 80.2707)$$,
  '22023', 'listing.location_invalid', 'a latitude below -90 is refused'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 13.0827, 181)$$,
  '22023', 'listing.location_invalid', 'a longitude above 180 is refused'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 'NaN'::double precision, 80.2707)$$,
  '22023', 'listing.location_invalid', 'a latitude that is not a number is refused'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 13.0827, 'Infinity'::double precision)$$,
  '22023', 'listing.location_invalid', 'an infinite longitude is refused'
);

-- A real point outside the region is refused
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 28.6139, 77.2090)$$,
  '22023', 'listing.location_out_of_region', 'a point in Delhi is outside the region'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 13.0827, 70)$$,
  '22023', 'listing.location_out_of_region', 'a point with a good latitude and a longitude west of the region is refused'
);

-- Someone else's listing, one that does not exist and a closed one
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000007', 13.0827, 80.2707)$$,
  'P0002', 'listing.not_found', 'someone else''s draft looks like a listing that does not exist'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000009', 13.0827, 80.2707)$$,
  'P0002', 'listing.not_found', 'someone else''s live listing looks the same'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-0000000000ee', 13.0827, 80.2707)$$,
  'P0002', 'listing.not_found', 'a listing that does not exist is refused the same way'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000006', 13.0, 80.0)$$,
  '55000', 'listing.not_editable', 'a sold listing cannot be moved'
);

-- A listing in review and a rejected one can be changed and keep their status
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000002', 13.6, 80.4)),
  'pending',
  'a listing in review can be changed (the corner of the region is inside it)'
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000005', 13.0827, 80.2707)),
  'rejected',
  'a rejected listing can be changed and stays rejected'
);

-- A live listing: the same point changes nothing, a different one sends it back to review (policy C)
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000003', 13.0827, 80.2707)),
  'approved',
  'sending a live listing the point it already has changes nothing'
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000003', 11.0168, 76.9558)),
  'pending',
  'moving the pin of a live listing sends it back to review'
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000004', 13.0827, 80.2707)),
  'pending',
  'adding a location to a live listing that has none sends it back to review'
);

-- Submit requires a location (ADR-138)
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000008')$$,
  '23514', 'listing.location_required', 'a draft with no location is refused'
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-000000000012')$$,
  '23514', 'listing.location_required', 'a rejected listing with no location cannot be resubmitted'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'draft',
  'the refused draft stays a draft'
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000008', 13.0827, 80.2707)),
  'draft',
  'the owner then adds the location'
);
select is(
  (select public.submit_listing('00000000-0000-4000-9000-000000000008')),
  (select short_id from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'a draft with a location is submitted'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000008'),
  'pending',
  'and it is pending'
);
reset role;

-- What was stored (longitude first), and what the public copy is
select ok(
  (select abs(extensions.st_x(location::extensions.geometry) - 80.2707) < 0.0000001
      and abs(extensions.st_y(location::extensions.geometry) - 13.0827) < 0.0000001
   from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'the point is stored longitude first, and the refused calls left it alone'
);
select ok(
  (select abs(extensions.st_x(public_location::extensions.geometry) - 80.271) < 0.0000001
      and abs(extensions.st_y(public_location::extensions.geometry) - 13.083) < 0.0000001
   from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'the public location follows, rounded to 0.001 degree'
);
select ok(
  (select extensions.st_distance(location, public_location) between 1 and 100
   from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'and it is a different point within 100 m of the exact one'
);
select ok(
  (select abs(extensions.st_x(location::extensions.geometry) - 80.4) < 0.0000001
      and abs(extensions.st_y(location::extensions.geometry) - 13.6) < 0.0000001
   from public.properties where id = '00000000-0000-4000-9000-000000000002'),
  'the corner of the region was stored for the listing in review'
);
select ok(
  (select status = 'rejected' and rejection_reason = 'Photos are not of the home.'
      and location is not null
   from public.properties where id = '00000000-0000-4000-9000-000000000005'),
  'the rejected listing kept its status and its reason and now has a location'
);
select ok(
  (select status = 'pending' and submitted_at is not null
      and abs(extensions.st_x(location::extensions.geometry) - 76.9558) < 0.0000001
      and abs(extensions.st_y(location::extensions.geometry) - 11.0168) < 0.0000001
   from public.properties where id = '00000000-0000-4000-9000-000000000003'),
  'the moved live listing is pending, stamped for review, with the new point'
);
select ok(
  (select status = 'pending' and location is not null
   from public.properties where id = '00000000-0000-4000-9000-000000000004'),
  'the legacy live listing is pending and now has a location'
);
select ok(
  (select abs(extensions.st_x(location::extensions.geometry) - 80.2707) < 0.0000001
      and abs(extensions.st_y(location::extensions.geometry) - 13.0827) < 0.0000001
   from public.properties where id = '00000000-0000-4000-9000-000000000006'),
  'the sold listing kept its point'
);
select is(
  (select count(*) from public.audit_log
   where entity_type = 'property' and entity_id = '00000000-0000-4000-9000-000000000004'
     and action = 'listing.status_changed' and diff ->> 'from' = 'approved' and diff ->> 'to' = 'pending')::int,
  1,
  'the move back to review is in the audit log'
);

-- DB-FN-set_listing_location: the other person, with and without a phone, and a visitor
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000007', 13.0827, 80.2707)),
  'draft',
  'the other owner sets a location on their own draft'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000001', 13.0, 80.0)$$,
  'P0002', 'listing.not_found', 'the first owner''s draft is not theirs to move'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000007', 13.0, 80.0)$$,
  '42501', 'listing.not_allowed', 'an account with no verified phone is refused'
);
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000007', 13.0, 80.0)$$,
  '42501', 'listing.not_allowed', 'a session with no person in it is refused'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000007', 13.0, 80.0)$$,
  '42501', null, 'a visitor cannot call set_listing_location'
);
reset role;

-- With no usable region the numeric range is the only test
update public.site_settings set value = jsonb_build_object('name', 'Tamil Nadu') where key = 'region';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000007', 28.6139, 77.2090)),
  'draft',
  'with no bounds in the settings a point anywhere in the world range is accepted'
);
select throws_ok(
  $$select public.set_listing_location('00000000-0000-4000-9000-000000000007', 128.6139, 77.2090)$$,
  '22023', 'listing.location_invalid', 'and a latitude out of range is still refused'
);
reset role;
update public.site_settings set value = jsonb_build_object(
  'name', 'Tamil Nadu',
  'bounds', jsonb_build_object('south', 13.6, 'west', 80.4, 'north', 8.0, 'east', 76.2)
) where key = 'region';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select is(
  (select public.set_listing_location('00000000-0000-4000-9000-000000000007', 28.6139, 77.2090)),
  'draft',
  'bounds that are upside down count as no bounds'
);
reset role;

-- A live listing without a location is not broken by the migration (ADR-060: old listings stay valid)
set local role anon;
select is(
  (select count(*)::int from public.search_properties()
   where id = '00000000-0000-4000-9000-000000000010' and latitude is null and longitude is null),
  1,
  'a live listing with no location still appears in search, with no coordinates'
);
select is(
  (select count(*)::int from public.search_properties(p_lat => 13.0827, p_lng => 80.2707, p_radius_km => 50)
   where id = '00000000-0000-4000-9000-000000000010'),
  0,
  'and is left out of radius search, as before'
);
-- A listing sent back to review is no longer public until it is approved again
select is(
  (select count(*)::int from public.search_properties()
   where id in ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-9000-000000000004')),
  0,
  'listings sent back to review by a location change are out of public search until approved'
);

-- DB-PRIV-exact-location (DEC-35): the public search gives the rounded point, never the exact one
select ok(
  (select abs(latitude - 13.083) < 0.0000001 and abs(longitude - 80.271) < 0.0000001
   from public.search_properties() where id = '00000000-0000-4000-9000-000000000011'),
  'the public search returns the rounded point of a listing, not its exact point'
);
select ok(
  not exists (
    select 1
    from pg_proc as proc, unnest(proc.proargnames) as output(name)
    where proc.proname = 'search_properties'
      and output.name in ('location', 'owner_id', 'address')
  ),
  'search_properties has no column for the exact location'
);
select throws_ok(
  $$select location from public.properties$$,
  '42501', null, 'a visitor cannot read the exact location'
);
reset role;

-- A signed-in person cannot read it either, not even their own
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select throws_ok(
  $$select location from public.properties$$,
  '42501', null, 'a signed-in person cannot read the exact location of a listing, their own included'
);
reset role;

select * from finish();
rollback;
