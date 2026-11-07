-- F06 media pipeline (S6-T01). Tests: DB-FN-finalize_listing_media, DB-FN-orphan_listing_photos,
-- DB-FN-arm_media_sweep, DB-PRIV-media-functions.
begin;
select plan(39);

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());

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

-- A stored file, as the storage service would have left it.
create function pg_temp.put(object_name text, age interval default interval '0')
returns void
language sql
as $$
  insert into storage.objects (bucket_id, name, created_at)
  values ('listing-photos', object_name, now() - age)
$$;

-- L1 is a draft of o1, L2 a draft of o2, L3 a sold listing of o1, L4 an approved listing of o1,
-- L5 a draft of o1 used for the limit.
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a1');
update public.properties set status = 'pending' where id in
  ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-9000-000000000004');
update public.properties set status = 'approved' where id in
  ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-9000-000000000004');
update public.properties set status = 'sold' where id = '00000000-0000-4000-9000-000000000003';

-- Files for the happy path
select pg_temp.put('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f1.jpg');
select pg_temp.put('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f2.webp');

-- DB-FN-finalize_listing_media: a photo is recorded
select is(
  (select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f1.jpg',
    'image/jpeg', 250000, 1600, 1200)) is not null,
  true,
  'the first photo is recorded and its id returned'
);
select is(
  (select is_cover from public.listing_media
   where storage_path like '%f1.jpg'),
  true,
  'the first photo becomes the cover (existing trigger)'
);
select is(
  (select position from public.listing_media where storage_path like '%f1.jpg')::int,
  0,
  'the first photo is at position 0'
);
select is(
  (select width || 'x' || height || ' ' || mime || ' ' || bytes from public.listing_media where storage_path like '%f1.jpg'),
  '1600x1200 image/jpeg 250000',
  'the size, type and bytes the server read are stored'
);

-- The same path again returns the same row (a retried request stores nothing twice)
select is(
  (select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f1.jpg',
    'image/jpeg', 250000, 1600, 1200)),
  (select id from public.listing_media where storage_path like '%f1.jpg'),
  'finishing the same file twice returns the same photo'
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001')::int,
  1,
  'and stores only one row'
);

-- A second photo goes after the first and is not the cover
select public.finalize_listing_media(
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
  '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f2.webp',
  'image/webp', 90000, 1280, 960);
select is(
  (select position from public.listing_media where storage_path like '%f2.webp')::int,
  1,
  'the second photo goes at position 1'
);
select is(
  (select is_cover from public.listing_media where storage_path like '%f2.webp'),
  false,
  'and is not the cover'
);

-- Who the listing belongs to
select pg_temp.put('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000002/00000000-0000-4000-8000-0000000000f3.jpg');
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000002',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000002/00000000-0000-4000-8000-0000000000f3.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  'P0002', 'media.listing_not_found', 'a listing of another user is not found, even under my own folder'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-0000000000ff',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-0000000000ff/00000000-0000-4000-8000-0000000000f3.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  'P0002', 'media.listing_not_found', 'a listing that does not exist is not found'
);

-- Closed listings
select pg_temp.put('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000003/00000000-0000-4000-8000-0000000000f4.jpg');
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000003',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000003/00000000-0000-4000-8000-0000000000f4.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  '42501', 'media.listing_closed', 'a sold listing takes no more photos'
);

-- The path must be exactly what the server issued
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f5.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  '22023', 'media.path', 'another user''s folder is refused'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000002/00000000-0000-4000-8000-0000000000f5.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  '22023', 'media.path', 'another listing''s folder is refused'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/holiday.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  '22023', 'media.path', 'a name that is not a generated id is refused'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f6.png',
    'image/jpeg', 1000, 800, 600)$$,
  '22023', 'media.path', 'an extension that does not match the type is refused'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f6.svg',
    'image/svg+xml', 1000, 800, 600)$$,
  '22023', 'media.path', 'SVG is refused'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f7.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  'P0002', 'media.object_missing', 'a file that is not in the bucket is refused'
);

-- Policy C: a new photo on an approved listing sends it back to review (existing trigger)
select pg_temp.put('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000004/00000000-0000-4000-8000-0000000000f8.jpg');
select public.finalize_listing_media(
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000004',
  '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000004/00000000-0000-4000-8000-0000000000f8.jpg',
  'image/jpeg', 1000, 800, 600);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000004'),
  'pending',
  'adding a photo to an approved listing sends it back to review'
);

-- The limit: six photos, the seventh is refused
select pg_temp.put(format('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000005/00000000-0000-4000-8000-00000000010%s.jpg', n))
from generate_series(1, 7) as n;
select lives_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000005',
    format('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000005/00000000-0000-4000-8000-00000000010%s.jpg', n),
    'image/jpeg', 1000, 800, 600)
    from generate_series(1, 6) as n$$,
  'six photos are recorded'
);
select throws_ok(
  $$select public.finalize_listing_media(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-9000-000000000005',
    '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000005/00000000-0000-4000-8000-000000000107.jpg',
    'image/jpeg', 1000, 800, 600)$$,
  'P0001', 'listing_media.limit', 'the seventh photo is refused'
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000005')::int,
  6,
  'and the listing keeps six'
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000005' and is_cover)::int,
  1,
  'with exactly one cover'
);

-- DB-PRIV-media-functions: only the server may call them
select ok(
  not has_function_privilege('authenticated', 'public.finalize_listing_media(uuid,uuid,text,text,integer,integer,integer)', 'execute'),
  'a signed-in user cannot call finalize_listing_media'
);
select ok(
  not has_function_privilege('anon', 'public.finalize_listing_media(uuid,uuid,text,text,integer,integer,integer)', 'execute'),
  'a visitor cannot call finalize_listing_media'
);
select ok(
  has_function_privilege('service_role', 'public.finalize_listing_media(uuid,uuid,text,text,integer,integer,integer)', 'execute'),
  'the service role can call finalize_listing_media'
);
select ok(
  not has_function_privilege('authenticated', 'public.orphan_listing_photos(integer,integer)', 'execute')
    and not has_function_privilege('anon', 'public.orphan_listing_photos(integer,integer)', 'execute'),
  'nobody but the server can list orphan files'
);
select ok(
  has_function_privilege('service_role', 'public.orphan_listing_photos(integer,integer)', 'execute'),
  'the service role can list orphan files'
);

-- DB-FN-orphan_listing_photos: old files with no row, and only those
select pg_temp.put('00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/00000000-0000-4000-8000-0000000000e1.jpg', interval '2 days');
select pg_temp.put('00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/00000000-0000-4000-8000-0000000000e2.jpg', interval '2 hours');
select pg_temp.put('00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/.emptyFolderPlaceholder', interval '3 days');
update storage.objects set created_at = now() - interval '3 days'
where name like '%f1.jpg' and bucket_id = 'listing-photos';
select is(
  (select array_agg(name) from public.orphan_listing_photos()),
  array['00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-9000-000000000002/00000000-0000-4000-8000-0000000000e1.jpg'],
  'only the old file with no photo row is listed (not a new one, not a claimed one, not a folder placeholder)'
);
select is(
  (select count(*) from public.orphan_listing_photos(1))::int,
  2,
  'a shorter age lists the two-hour-old file too'
);
select is(
  (select count(*) from public.orphan_listing_photos(1, 1))::int,
  1,
  'the batch size caps the list'
);
delete from public.listing_media where storage_path like '%f1.jpg';
select ok(
  exists (select 1 from public.orphan_listing_photos() where name like '%f1.jpg'),
  'a file whose photo row was removed is listed once it is old enough'
);

-- DB-FN-arm_media_sweep: same pattern as the CRM retry
select throws_ok(
  $$select public.arm_media_sweep()$$,
  'P0001', 'media_sweep.not_configured', 'arming needs the public URL and the job token to be set'
);
insert into public.app_config (key, value) values ('app.public_url', 'https://dev.example.test');
insert into public.internal_cron_tokens (name, token)
values ('media_sweep', 'test-token-not-real-0123456789abcdef');
select lives_ok($$select public.arm_media_sweep()$$, 'arming schedules the sweep job');
select ok(exists (select 1 from cron.job where jobname = 'media-sweep'), 'the sweep job exists after arming');
select lives_ok($$select public.arm_media_sweep()$$, 'arming twice replaces the job');
select is(
  (select count(*) from cron.job where jobname = 'media-sweep')::int,
  1,
  'there is only one sweep job'
);
select lives_ok($$select public.disarm_media_sweep()$$, 'disarming removes the sweep job');
select ok(not exists (select 1 from cron.job where jobname = 'media-sweep'), 'the sweep job is gone after disarming');
select ok(
  not has_function_privilege('authenticated', 'public.arm_media_sweep()', 'execute'),
  'a signed-in user cannot arm the job'
);

select * from finish();
rollback;
