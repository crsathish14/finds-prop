-- Customer email plan PR 1 (ADR-195): a draft needs a verified email to be sent for review when the site says so.
-- Tests: DB-FN-has_verified_email, DB-BR-submit-needs-verified-email (the switch is the site_settings row
-- posting_requires_verified_email), DB-PRIV-has_verified_email.
begin;
select plan(17);

-- b1: a verified email.  b2: an email not confirmed yet.  b3: no email (phone only).  b4: another owner.
-- b5: an empty email that is confirmed (cannot be used).
insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', '919100000011', now(), 'verified@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', '919100000012', now(), 'waiting@example.test', null),
  ('00000000-0000-4000-8000-0000000000b3', '919100000013', now(), null, null),
  ('00000000-0000-4000-8000-0000000000b4', '919100000014', now(), 'other@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b5', '919100000015', now(), '', now());

-- A complete draft with a photo for each owner. The system role fills it in.
create function pg_temp.new_listing(listing uuid, owner uuid, listing_status text default 'draft')
returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address, location, rejection_reason
  ) values (
    listing, owner, listing_status, 'sale', 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road',
    extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography,
    case when listing_status = 'rejected' then 'Photos are not of the home.' end
  ) returning id
$$;

create function pg_temp.new_listing_with_photo(listing uuid, owner uuid, listing_status text default 'draft')
returns void
language sql
as $$
  select pg_temp.new_listing(listing, owner, listing_status);
  insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
  values (listing, 'email-test/' || listing::text || '.jpg', 'image/jpeg', 200000, 1600, 1200);
$$;

select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e1', '00000000-0000-4000-8000-0000000000b1');
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e2', '00000000-0000-4000-8000-0000000000b2');
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e3', '00000000-0000-4000-8000-0000000000b3');
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e4', '00000000-0000-4000-8000-0000000000b4');
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e5', '00000000-0000-4000-8000-0000000000b5');
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e6', '00000000-0000-4000-8000-0000000000b3');
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e7', '00000000-0000-4000-8000-0000000000b3');
-- e8 is a rejected listing of b3 (no email).
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000e8', '00000000-0000-4000-8000-0000000000b3', 'pending');
update public.properties set status = 'rejected', rejection_reason = 'Photos are not of the home.'
  where id = '00000000-0000-4000-9000-0000000000e8';

-- Without the setting nothing changes: a phone-only person submits (the site as it ships)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated", "phone": "919100000013"}',
  true
);
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e3')$$,
  'with no setting, an account with no email can submit a draft'
);
reset role;

-- The setting present but off, or not a clear yes, is off
insert into public.site_settings (key, value) values ('posting_requires_verified_email', '{"enabled": false}');
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated", "phone": "919100000013"}',
  true
);
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e6')$$,
  'with the setting off, an account with no email can submit a draft'
);
reset role;
update public.site_settings set value = '{"enabled": "true"}' where key = 'posting_requires_verified_email';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated", "phone": "919100000013"}',
  true
);
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e7')$$,
  'a setting that is not a true boolean counts as off'
);
reset role;

-- DB-BR-submit-needs-verified-email: the setting is on
update public.site_settings set value = '{"enabled": true}' where key = 'posting_requires_verified_email';
select pg_temp.new_listing_with_photo('00000000-0000-4000-9000-0000000000f3', '00000000-0000-4000-8000-0000000000b3');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated", "phone": "919100000013"}',
  true
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000f3')$$,
  '42501', 'listing.email_required',
  'with the setting on, an account with no email cannot submit a draft'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-0000000000f3'),
  'draft',
  'the refused draft stays a draft'
);
select is(
  (select public.has_verified_email()),
  false,
  'has_verified_email is false for an account with no email'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated", "phone": "919100000012"}',
  true
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e2')$$,
  '42501', 'listing.email_required',
  'with the setting on, an email that is not confirmed does not count'
);
select is((select public.has_verified_email()), false, 'has_verified_email is false for an unconfirmed email');

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b5", "role": "authenticated", "phone": "919100000015"}',
  true
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e5')$$,
  '42501', 'listing.email_required',
  'with the setting on, an empty address does not count'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated", "phone": "919100000011"}',
  true
);
select is((select public.has_verified_email()), true, 'has_verified_email is true for a confirmed email');
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e1')$$,
  'with the setting on, an account with a verified email can submit a draft'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-0000000000e1'),
  'pending',
  'and the listing is now pending'
);

-- Someone else's listing still looks like one that does not exist, whoever asks and whatever the setting says
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e4')$$,
  'P0002', 'listing.not_found',
  'a verified account cannot submit another person''s listing'
);
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated", "phone": "919100000013"}',
  true
);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e4')$$,
  'P0002', 'listing.not_found',
  'an account with no email learns nothing about another person''s listing'
);

-- Only a draft is gated: a rejected listing goes back with no email
select lives_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e8')$$,
  'a rejected listing can be resubmitted with no verified email'
);

-- The phone rule is still first
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.submit_listing('00000000-0000-4000-9000-0000000000e1')$$,
  '42501', 'listing.not_allowed',
  'an account with no verified phone is still refused first'
);
reset role;

-- Visitors cannot call the helper or the function
set local role anon;
select throws_ok(
  $$select public.has_verified_email()$$,
  '42501', null,
  'a visitor cannot call has_verified_email'
);

select * from finish();
rollback;
