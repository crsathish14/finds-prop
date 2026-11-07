-- F10 listing moderation (S6-T04). Tests: DB-FN-moderate_listing, DB-FN-admin_listing_queue,
-- DB-FN-admin_listing_counts, DB-PRIV-moderation-functions, DB-AUDIT-moderation.
begin;
select plan(49);

-- ad is the reserved admin (the super_admin role is granted to this address); o1 owns the listings,
-- o2 is another customer, bu is a builder user.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now(), 'priya@example.test', now());
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());
insert into public.profiles (id, full_name)
values ('00000000-0000-4000-8000-0000000000a1', 'Priya Raman')
on conflict (id) do update set full_name = excluded.full_name;

-- Listings in every state. The system role fills them in, so the owner rules do not apply to set-up.
create function pg_temp.new_listing(listing uuid, owner uuid, listing_status text, place text, kind text default 'sale')
returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address, rejection_reason
  ) values (
    listing, owner, listing_status, kind, 'apartment', 'Home in ' || place, 'A bright flat.', 8500000, 950,
    place, 'Chennai', 'Tamil Nadu', '600020', '12 Beach Road',
    case when listing_status = 'rejected' then 'Photos are not of the home.' end
  ) returning id
$$;

select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'pending', 'Adyar');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'pending', 'Velachery', 'rent');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a2', 'pending', 'Adyar');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a2', 'approved', 'Medavakkam');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a2', 'rejected', 'Adyar');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-0000000000a2', 'sold', 'Velachery');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-8000-0000000000a2', 'draft', 'Guindy');
-- Make the submission times distinct, newest first by number.
update public.properties set submitted_at = now() - interval '1 hour' * (9 - right(id::text, 1)::int)
where status <> 'draft' and id::text like '00000000-0000-4000-9000-00000000000_';
insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, position)
values
  ('00000000-0000-4000-9000-000000000001', 'a1/l1/two.jpg', 'image/jpeg', 100000, 1600, 1200, 1),
  ('00000000-0000-4000-9000-000000000001', 'a1/l1/one.jpg', 'image/jpeg', 100000, 1600, 1200, 0);

-- DB-PRIV: not callable by a visitor, a customer or a builder
set local role anon;
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'approve')$$,
  '42501', null, 'a visitor cannot moderate (no execute grant)'
);
select throws_ok(
  $$select * from public.admin_listing_queue()$$, '42501', null, 'a visitor cannot read the queue'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'approve')$$,
  '42501', 'listing.not_allowed', 'a customer, even the owner, cannot approve their own listing'
);
select throws_ok($$select * from public.admin_listing_queue()$$, '42501', 'listing.not_allowed', 'a customer cannot read the queue');
select throws_ok($$select * from public.admin_listing_counts()$$, '42501', 'listing.not_allowed', 'a customer cannot read the counts');
select throws_ok($$select * from public.admin_listing_localities()$$, '42501', 'listing.not_allowed', 'a customer cannot read the localities');
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  'pending', 'the refused approval changed nothing'
);
reset role;

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- DB-FN-admin_listing_counts
select results_eq(
  $$select pending, approved, rejected, closed, total from public.admin_listing_counts()$$,
  $$values (3, 1, 1, 1, 6)$$,
  'the counts exclude drafts and fold sold and rented together'
);

-- DB-FN-admin_listing_queue
select results_eq(
  $$select short_id is not null, id::text from public.admin_listing_queue('pending')$$,
  $$values (true, '00000000-0000-4000-9000-000000000003'), (true, '00000000-0000-4000-9000-000000000002'), (true, '00000000-0000-4000-9000-000000000001')$$,
  'the pending tab lists pending listings, newest submission first'
);
select is((select count(*) from public.admin_listing_queue('all'))::int, 6, 'all is every listing except drafts');
select is((select count(*) from public.admin_listing_queue('closed'))::int, 1, 'closed is sold or rented');
select is((select count(*) from public.admin_listing_queue('rejected'))::int, 1, 'the rejected tab');
select is(
  (select count(*) from public.admin_listing_queue('all', 'Adyar'))::int, 3, 'the locality filter'
);
select is(
  (select count(*) from public.admin_listing_queue('all', null, 'rent'))::int, 1, 'the listing type filter'
);
select is(
  (select count(*) from public.admin_listing_queue('all', 'Adyar', 'rent'))::int, 0, 'filters combine'
);
select is(
  (select owner_name || ' <' || owner_email || '>' from public.admin_listing_queue('pending') where id = '00000000-0000-4000-9000-000000000001'),
  'Priya Raman <priya@example.test>', 'the owner''s name and email come with the row'
);
select is(
  (select owner_name is null and owner_email is null from public.admin_listing_queue('pending') where id = '00000000-0000-4000-9000-000000000003'),
  true, 'an owner with no name or email gives empty values, not an error'
);
select is(
  (select photos #>> '{0,path}' from public.admin_listing_queue('pending') where id = '00000000-0000-4000-9000-000000000001'),
  'a1/l1/one.jpg', 'photos come in order'
);
select is(
  (select jsonb_array_length(photos) from public.admin_listing_queue('pending') where id = '00000000-0000-4000-9000-000000000002'),
  0, 'a listing with no photos has an empty list'
);
select is(
  (select rejection_reason from public.admin_listing_queue('rejected')), 'Photos are not of the home.',
  'a rejected row carries its reason'
);
select is((select count(*) from public.admin_listing_queue('all', null, null, null, null, 2))::int, 2, 'the page size is honoured');
select results_eq(
  $$select id::text from public.admin_listing_queue(
      'all', null, null,
      (select submitted_at from public.admin_properties() where id = '00000000-0000-4000-9000-000000000004'),
      '00000000-0000-4000-9000-000000000004', 10)$$,
  $$values ('00000000-0000-4000-9000-000000000003'), ('00000000-0000-4000-9000-000000000002'), ('00000000-0000-4000-9000-000000000001')$$,
  'the next page starts after the last row seen'
);
select throws_ok($$select * from public.admin_listing_queue('nonsense')$$, '22023', 'listing.bad_filter', 'an unknown tab is refused');
select throws_ok($$select * from public.admin_listing_queue('all', null, 'lease')$$, '22023', 'listing.bad_filter', 'an unknown listing type is refused');
select throws_ok(
  $$select * from public.admin_listing_queue('all', null, null, now(), null)$$,
  '22023', 'listing.bad_filter', 'half a page marker is refused'
);
select is((select count(*) from public.admin_listing_localities())::int, 3, 'localities: those of non-draft listings, each once');

-- DB-FN-moderate_listing: approve
select results_eq(
  $$select status, featured from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'approve')$$,
  $$values ('approved', false)$$,
  'approve returns the new status'
);
select is(
  (select moderated_by::text from public.admin_properties() where id = '00000000-0000-4000-9000-000000000001'),
  '00000000-0000-4000-8000-0000000000ad', 'the approval is stamped with the admin'
);
select ok(
  (select published_at is not null and moderated_at is not null from public.admin_properties() where id = '00000000-0000-4000-9000-000000000001'),
  'an approved listing is published and has a decision time'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'approve')$$,
  '55000', 'listing.not_reviewable', 'approving an approved listing is refused'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000005', 'approve')$$,
  '55000', 'listing.not_reviewable', 'a rejected listing cannot be approved (the owner must resubmit)'
);

-- reject
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000002', 'reject')$$,
  '23514', 'listing.reason_required', 'a rejection needs a reason'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000002', 'reject', '   ')$$,
  '23514', 'listing.reason_required', 'a blank reason does not count'
);
select throws_ok(
  format($$select * from public.moderate_listing('00000000-0000-4000-9000-000000000002', 'reject', %L)$$, repeat('x', 501)),
  '23514', 'listing.reason_required', 'a reason over 500 characters is refused'
);
select results_eq(
  $$select status from public.moderate_listing('00000000-0000-4000-9000-000000000002', 'reject', '  Add a photo of the home.  ')$$,
  $$values ('rejected')$$, 'reject with a reason'
);
select is(
  (select rejection_reason from public.admin_properties() where id = '00000000-0000-4000-9000-000000000002'),
  'Add a photo of the home.', 'the reason is stored trimmed'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000004', 'reject', 'No.')$$,
  '55000', 'listing.not_reviewable', 'an approved listing cannot be rejected from the queue'
);

-- feature and unfeature
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000003', 'feature')$$,
  '55000', 'listing.not_featurable', 'a pending listing cannot be featured'
);
select results_eq(
  $$select featured from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'feature')$$,
  $$values (true)$$, 'an approved listing can be featured'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'feature')$$,
  '55000', 'listing.not_featurable', 'featuring twice is refused'
);
select results_eq(
  $$select featured from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'unfeature')$$,
  $$values (false)$$, 'a feature can be removed'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'unfeature')$$,
  '55000', 'listing.not_featurable', 'removing a feature that is not there is refused'
);

-- bad calls
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'delete')$$,
  '22023', 'listing.bad_action', 'an unknown action is refused'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-0000000000ff', 'approve')$$,
  'P0002', 'listing.not_found', 'a listing that does not exist'
);

reset role;

-- DB-AUDIT-moderation: each decision is in the audit log, by the admin
select is(
  (select count(*) from public.audit_log
   where entity_id = '00000000-0000-4000-9000-000000000001' and action = 'listing.status_changed'
     and actor_role = 'super_admin' and actor_id = '00000000-0000-4000-8000-0000000000ad'
     and diff ->> 'from' = 'pending' and diff ->> 'to' = 'approved')::int,
  1, 'the approval is recorded, with the admin as the actor'
);
select is(
  (select diff ->> 'reason' from public.audit_log
   where entity_id = '00000000-0000-4000-9000-000000000002' and action = 'listing.status_changed'
     and diff ->> 'to' = 'rejected'),
  'Add a photo of the home.', 'the rejection and its reason are recorded'
);
select is(
  (select count(*) from public.audit_log
   where entity_id = '00000000-0000-4000-9000-000000000001' and action = 'listing.status_changed'
     and (diff ->> 'featured')::boolean)::int,
  1, 'featuring is recorded'
);

-- The owner sees the decision and its reason; the public sees only what is approved
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}', true);
select is(
  (select rejection_reason from public.my_properties() where id = '00000000-0000-4000-9000-000000000002'),
  'Add a photo of the home.', 'the owner reads the reason through my_properties()'
);
reset role;
set local role anon;
select is(
  (select count(*) from public.properties where id in (
    '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000002'))::int,
  1, 'the public sees the approved listing and not the rejected one'
);
reset role;
select * from finish();
rollback;
