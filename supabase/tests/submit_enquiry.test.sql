-- F06 enquiries (S5-T03): submit_enquiry(). Tests: DB-FN-submit_enquiry (BR-50, DEC-26).
begin;
select plan(18);

-- o1 owns the listings, b1 and b2 send enquiries.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000e1', '919100000011', now()),
  ('00000000-0000-4000-8000-0000000000e2', '919100000012', now()),
  ('00000000-0000-4000-8000-0000000000e3', '919100000013', now());

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

select pg_temp.new_listing('00000000-0000-4000-9000-0000000000e1', '00000000-0000-4000-8000-0000000000e1');
select pg_temp.new_listing('00000000-0000-4000-9000-0000000000e2', '00000000-0000-4000-8000-0000000000e1');
select pg_temp.new_listing('00000000-0000-4000-9000-0000000000e3', '00000000-0000-4000-8000-0000000000e1', 'pending');

create function pg_temp.short(listing uuid) returns text language sql as
  $$ select short_id from public.properties where id = listing $$;

-- Only the server (service_role) may call it
select ok(
  not has_function_privilege('anon', 'public.submit_enquiry(text,uuid,text,text,text,text)', 'execute'),
  'anon cannot call submit_enquiry'
);
select ok(
  not has_function_privilege('authenticated', 'public.submit_enquiry(text,uuid,text,text,text,text)', 'execute'),
  'a signed-in user cannot call submit_enquiry directly'
);
select ok(
  has_function_privilege('service_role', 'public.submit_enquiry(text,uuid,text,text,text,text)', 'execute'),
  'the server can call submit_enquiry'
);

-- A first enquiry is stored for the user the server names, and its id is returned
select ok(
  public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e1'),
    '00000000-0000-4000-8000-0000000000e2', '  Priya Raman ', '919840012345', 'priya@example.test', '  Is it still available? ') is not null,
  'an enquiry is stored and its id returned'
);
select results_eq(
  $$select name, phone, email, message, status, user_id::text, property_id::text
    from public.enquiries where user_id = '00000000-0000-4000-8000-0000000000e2'$$,
  $$values ('Priya Raman'::text, '919840012345'::text, 'priya@example.test'::text,
            'Is it still available?'::text, 'new'::text,
            '00000000-0000-4000-8000-0000000000e2'::text, '00000000-0000-4000-9000-0000000000e1'::text)$$,
  'the enquiry keeps the trimmed name and message, the phone, the user and the home, and starts as new'
);

-- Empty email and message are stored as null
select lives_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e1'),
      '00000000-0000-4000-8000-0000000000e3', 'Arun Kumar', '919840012346', '', '   ')$$,
  'an enquiry with an empty email and message is stored'
);
select results_eq(
  $$select email, message from public.enquiries where user_id = '00000000-0000-4000-8000-0000000000e3'$$,
  $$values (null::text, null::text)$$,
  'an empty email and message become null'
);

-- The 24 hour rule (DEC-26)
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e1'),
      '00000000-0000-4000-8000-0000000000e2', 'Priya Raman', '919840012345', null, 'again')$$,
  '23505', 'enquiry.duplicate',
  'a second enquiry about the same home within 24 hours is refused as a duplicate'
);
select is(
  (select count(*)::int from public.enquiries where user_id = '00000000-0000-4000-8000-0000000000e2'),
  1,
  'the refused duplicate stored nothing'
);
select lives_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e2'),
      '00000000-0000-4000-8000-0000000000e2', 'Priya Raman', '919840012345', null, null)$$,
  'the same user can enquire about a different home'
);
update public.enquiries set created_at = now() - interval '25 hours'
  where user_id = '00000000-0000-4000-8000-0000000000e2'
    and property_id = '00000000-0000-4000-9000-0000000000e1';
select lives_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e1'),
      '00000000-0000-4000-8000-0000000000e2', 'Priya Raman', '919840012345', null, 'a day later')$$,
  'the same user can enquire about the same home again after 24 hours'
);

-- What cannot be enquired about
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e1'),
      '00000000-0000-4000-8000-0000000000e1', 'Owner', '919840012347', null, null)$$,
  '42501', 'enquiry.own_listing',
  'the owner cannot enquire about their own home'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e3'),
      '00000000-0000-4000-8000-0000000000e2', 'Priya Raman', '919840012345', null, null)$$,
  'P0002', 'enquiry.property_not_found',
  'a home waiting for review is not found'
);
select throws_ok(
  $$select public.submit_enquiry('zzzzzzzz',
      '00000000-0000-4000-8000-0000000000e2', 'Priya Raman', '919840012345', null, null)$$,
  'P0002', 'enquiry.property_not_found',
  'an unknown home is not found'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e1'),
      null, 'Priya Raman', '919840012345', null, null)$$,
  '22023', 'enquiry.user',
  'an enquiry with no user is refused'
);

-- The table's own checks still hold
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e2'),
      '00000000-0000-4000-8000-0000000000e3', 'A', '919840012346', null, null)$$,
  '23514', null,
  'a name shorter than 2 characters is refused'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e2'),
      '00000000-0000-4000-8000-0000000000e3', 'Arun Kumar', '12ab', null, null)$$,
  '23514', null,
  'a phone that is not 6 to 15 digits is refused'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.short('00000000-0000-4000-9000-0000000000e2'),
      '00000000-0000-4000-8000-0000000000e3', 'Arun Kumar', '919840012346', null, repeat('x', 1001))$$,
  '23514', null,
  'a message over 1000 characters is refused'
);

select * from finish();
rollback;
