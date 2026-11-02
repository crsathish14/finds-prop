-- S3-T13: what scripts/seed-dev.mjs adds to the seed: test users, builder links, photo files in Storage
-- and the listing_media rows that point at them. Run it after the script, on the same local database
-- (`node scripts/seed-dev.mjs`, then `supabase test db supabase/seed-dev-tests`). The pure-seed tests in
-- supabase/seed-tests run before the script, because they assert that no builder has signed in yet.
begin;
select plan(23);

-- Test users and their roles
select is(
  (select count(*) from auth.users where email like '%@seed.example')::int,
  4, 'four builder and agent test users'
);
select is(
  (select count(*) from auth.users where phone in ('919000000001', '919000000002'))::int,
  2, 'two customer test users, by phone'
);
select is(
  (select count(*) from auth.users where email = 'developer@findsprop.com')::int,
  1, 'the reserved administrator exists on the local stack'
);
select ok(
  public.has_role((select id from auth.users where email = 'developer@findsprop.com'), 'super_admin'),
  'and holds super_admin, granted by the identity trigger'
);
select is(
  (select count(*) from public.user_roles as role_row
   join auth.users as account on account.id = role_row.user_id
   where account.email like '%@seed.example' and role_row.role = 'builder')::int,
  4, 'each builder and agent test user holds the builder role'
);
select is(
  (select count(*) from public.builders where id::text like '5eed0000-0000-4000-8001-%' and user_id is not null)::int,
  4, 'four seeded builders are linked to a user'
);
select is(
  (select count(*) from public.builders
   where id = '5eed0000-0000-4000-8001-000000000005' and not active and user_id is not null)::int,
  1, 'the inactive builder is linked to a user and stays inactive'
);

-- Listing photos: three per listing, one cover, every row backed by a file
select is((select count(*) from public.listing_media)::int, 180, 'sixty listings with three photos each');
select is(
  (select count(*) from (
     select listing_id from public.listing_media group by listing_id having count(*) = 3
   ) as three)::int,
  60, 'every listing has exactly three'
);
select is((select count(*) from public.listing_media where is_cover)::int, 60, 'and exactly one cover each');
select is(
  (select count(*) from public.listing_media as media
   where not exists (
     select 1 from storage.objects as object
     where object.bucket_id = 'listing-photos' and object.name = media.storage_path
   ))::int,
  0, 'every photo row has its file in Storage'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'listing-photos')::int,
  180, 'and there are no stray files'
);

-- Adding photos sends an approved listing back to review; the script must put every one back
select is((select count(*) from public.properties where status = 'approved')::int, 42, 'still forty-two approved');
select is((select count(*) from public.properties where featured)::int, 3, 'still three featured');
select is((select count(*) from public.properties where status = 'pending')::int, 6, 'still six pending');
select is((select count(*) from public.properties where status = 'rejected')::int, 3, 'still three rejected');
select is((select count(*) from public.properties where status = 'sold')::int, 4, 'still four sold');
select is((select count(*) from public.properties where status = 'rented')::int, 2, 'still two rented');
select is((select count(*) from public.properties where status = 'draft')::int, 3, 'still three drafts');
select is(
  (select count(*) from public.properties
   where status = 'approved' and submitted_at > now() - interval '1 hour')::int,
  0, 'no approved listing kept the submitted time the review trigger gave it'
);

-- What a visitor sees
set local role anon;
select is(
  (select count(*) from public.listing_media)::int,
  126, 'a visitor sees the photos of the 42 approved listings only'
);
reset role;

-- Project images
select is(
  (select count(*) from public.projects
   where id::text like '5eed0000-0000-4000-8002-%' and cardinality(images) = 3
     and images[1] like id::text || '/%')::int,
  12, 'twelve projects with three images each, stored under the project id'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'project-media')::int,
  36, 'and thirty-six project files in Storage'
);

select * from finish();
rollback;
