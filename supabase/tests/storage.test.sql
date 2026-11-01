-- F08 storage. Tests: DB-STO-buckets, DB-STO-listing-photos, DB-STO-project-media,
-- DB-STO-site-assets, DB-STO-form-uploads-denied.
begin;
select plan(49);

-- o1 and o2 own listings, b1 and b2 are builders, c1 is a customer, ad is the reserved admin.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', 'Nila Habitats');
insert into public.projects (id, slug, name, builder_id, locality) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur'),
  ('00000000-0000-4000-c000-000000000005', 'thendral-heights', 'Thendral Heights', '00000000-0000-4000-b000-000000000002', 'Adyar');

create function pg_temp.new_listing(listing uuid, owner uuid, listing_status text default 'draft')
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

-- L1 belongs to o1, L2 to o2, L3 is a sold listing of o1.
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1');
update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000003';
update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000003';
update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-000000000003';

-- DB-STO-buckets
select is(
  (select array_agg(id order by id) from storage.buckets
   where id in ('listing-photos', 'project-media', 'form-uploads', 'site-assets') and public),
  array['listing-photos', 'project-media', 'site-assets'],
  'the photo, project and site buckets are public'
);
select is(
  (select public from storage.buckets where id = 'form-uploads'),
  false,
  'the form-uploads bucket is private'
);
select is((select file_size_limit from storage.buckets where id = 'listing-photos'), 10485760::bigint, 'listing photos are limited to 10 MB');
select is((select file_size_limit from storage.buckets where id = 'project-media'), 10485760::bigint, 'project media is limited to 10 MB');
select is((select file_size_limit from storage.buckets where id = 'form-uploads'), 5242880::bigint, 'form uploads are limited to 5 MB');
select is((select file_size_limit from storage.buckets where id = 'site-assets'), 524288::bigint, 'sponsor banners are limited to 500 KB');
select is(
  (select allowed_mime_types from storage.buckets where id = 'listing-photos'),
  array['image/webp', 'image/jpeg', 'image/png'],
  'listing photos accept WebP, JPEG and PNG only'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'site-assets'),
  array['image/webp', 'image/jpeg', 'image/png'],
  'site assets accept WebP, JPEG and PNG only'
);
select ok(
  'application/pdf' = any ((select allowed_mime_types from storage.buckets where id = 'project-media')),
  'project media accepts the PDF brochure'
);
select ok(
  not exists (select 1 from storage.buckets where 'image/svg+xml' = any (allowed_mime_types)),
  'no bucket accepts SVG'
);

-- The path helpers refuse anything malformed instead of failing
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select ok(
  public.storage_listing_path_ok('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/photo.webp'),
  'an owner may write under their own listing'
);
select ok(
  not public.storage_listing_path_ok('00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/photo.webp'),
  'another user''s folder is refused'
);
select ok(
  not public.storage_listing_path_ok('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000002/photo.webp'),
  'someone else''s listing is refused, even under my own folder'
);
select ok(
  not public.storage_listing_path_ok('00000000-0000-4000-8000-0000000000a1/not-a-uuid/photo.webp'),
  'a listing folder that is not an id is refused'
);
select ok(
  not public.storage_listing_path_ok('00000000-0000-4000-8000-0000000000a1/photo.webp'),
  'a path without a listing folder is refused'
);
select ok(
  not public.storage_listing_path_ok('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000003/photo.webp'),
  'a sold listing is refused'
);
select ok(not public.storage_listing_path_ok(''), 'an empty path is refused');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select ok(
  public.storage_project_path_ok('00000000-0000-4000-c000-000000000001/brochure.pdf'),
  'a builder may write under their own project'
);
select ok(
  not public.storage_project_path_ok('00000000-0000-4000-c000-000000000005/brochure.pdf'),
  'another builder''s project is refused'
);
select ok(not public.storage_project_path_ok('not-a-uuid/brochure.pdf'), 'a project folder that is not an id is refused');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select ok(
  public.storage_project_path_ok('00000000-0000-4000-c000-000000000005/brochure.pdf'),
  'the admin may write under any project'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select ok(
  not public.storage_project_path_ok('00000000-0000-4000-c000-000000000001/brochure.pdf'),
  'a customer may not write under a project'
);

-- DB-STO-listing-photos
insert into storage.objects (bucket_id, name)
values ('listing-photos', '00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/seed.webp');
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'listing-photos')::int,
  0,
  'a visitor cannot list a public bucket'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('listing-photos', 'anon/photo.webp')$$,
  '42501', null, 'a visitor cannot upload'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('listing-photos', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/one.webp')$$,
  'an owner can upload to their own listing'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('listing-photos', '00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/two.webp')$$,
  '42501', null, 'an owner cannot upload into another user''s folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('listing-photos', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000002/three.webp')$$,
  '42501', null, 'an owner cannot upload to another user''s listing'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('listing-photos', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000003/four.webp')$$,
  '42501', null, 'an owner cannot upload to a sold listing'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'listing-photos')::int,
  1,
  'an owner sees only their own files'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
select lives_ok(
  $$delete from storage.objects
    where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8000-0000000000a1/%'$$,
  'deleting another user''s file is accepted but matches nothing'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8000-0000000000a1/%')::int,
  0,
  'another user does not see the file'
);
reset role;
select is(
  (select count(*) from storage.objects where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8000-0000000000a1/%')::int,
  1,
  'the file is still there'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select cmp_ok(
  (select count(*) from storage.objects where bucket_id = 'listing-photos')::int,
  '>=',
  2,
  'the admin sees every listing photo'
);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8000-0000000000a2/%'$$,
  'the admin can delete a listing photo'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8000-0000000000a1/%'$$,
  'an owner can delete their own file'
);
reset role;
select is(
  (select count(*) from storage.objects where bucket_id = 'listing-photos')::int,
  0,
  'both files are gone'
);

-- DB-STO-project-media
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('project-media', '00000000-0000-4000-c000-000000000001/brochure.pdf')$$,
  'a builder can upload to their own project'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('project-media', '00000000-0000-4000-c000-000000000005/brochure.pdf')$$,
  '42501', null, 'a builder cannot upload to another builder''s project'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('project-media', '00000000-0000-4000-c000-000000000001/customer.pdf')$$,
  '42501', null, 'a customer cannot upload project media'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('project-media', '00000000-0000-4000-c000-000000000005/admin.pdf')$$,
  'the admin can upload to any project'
);
reset role;
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'project-media')::int,
  0,
  'a visitor cannot list project media'
);
reset role;

-- DB-STO-site-assets
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('site-assets', 'sponsors/one/strip-desktop.webp')$$,
  'the admin can upload a sponsor banner'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('site-assets', 'sponsors/two/strip-desktop.webp')$$,
  '42501', null, 'a builder cannot upload a sponsor banner'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('site-assets', 'sponsors/three/strip-desktop.webp')$$,
  '42501', null, 'a customer cannot upload a sponsor banner'
);
reset role;
set local role anon;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('site-assets', 'sponsors/four/strip-desktop.webp')$$,
  '42501', null, 'a visitor cannot upload a sponsor banner'
);
reset role;

-- DB-STO-form-uploads-denied
insert into storage.objects (bucket_id, name) values ('form-uploads', 'submission-1/resume.pdf');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('form-uploads', 'submission-2/resume.pdf')$$,
  '42501', null, 'not even the admin uploads to form-uploads directly'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'form-uploads')::int,
  0,
  'not even the admin lists form-uploads directly'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'form-uploads')::int,
  0,
  'a builder cannot list form-uploads'
);
reset role;
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'form-uploads')::int,
  0,
  'a visitor cannot list form-uploads'
);
reset role;

select * from finish();
rollback;
