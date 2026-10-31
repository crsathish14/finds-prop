-- F06 listing_media. Tests: DB-TRG-listing_media-limits, DB-CON-listing_media, DB-RLS-listing_media,
-- DB-TRG-listing_media-review (DEC-09 policy C).
begin;
select plan(29);

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a2', '919100000002', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

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

create function pg_temp.add_media(listing uuid, how_many integer)
returns void
language plpgsql
as $$
begin
  for step in 1..how_many loop
    insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, position)
    values (listing, listing::text || '/' || step || '.webp', 'image/webp', 50000, 1600, 1200, step);
  end loop;
end;
$$;

-- Moves a draft with photos through review to a final status.
create function pg_temp.publish(listing uuid, final_status text default 'approved')
returns void
language plpgsql
as $$
begin
  update public.properties set status = 'pending' where id = listing;
  update public.properties set status = 'approved' where id = listing;
  if final_status <> 'approved' then
    update public.properties set status = final_status where id = listing;
  end if;
end;
$$;

-- D1 and D2 are drafts, A1 is approved without photos, A3 is approved with 2 photos (owner o1),
-- S1 is sold with 1 photo (o1), P1 is approved with 2 photos (o2).
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-0000000000a2');
select pg_temp.add_media('00000000-0000-4000-9000-000000000004', 2);
select pg_temp.publish('00000000-0000-4000-9000-000000000004');
select pg_temp.add_media('00000000-0000-4000-9000-000000000005', 1);
select pg_temp.publish('00000000-0000-4000-9000-000000000005', 'sold');
select pg_temp.add_media('00000000-0000-4000-9000-000000000006', 2);
select pg_temp.publish('00000000-0000-4000-9000-000000000006');

-- DB-TRG-listing_media-limits
select pg_temp.add_media('00000000-0000-4000-9000-000000000001', 6);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001')::int,
  6,
  'a listing can hold 6 photos'
);
select is(
  (select count(*) from public.listing_media
   where listing_id = '00000000-0000-4000-9000-000000000001' and is_cover)::int,
  1,
  'exactly one photo is the cover'
);
select ok(
  (select position = 1 from public.listing_media
   where listing_id = '00000000-0000-4000-9000-000000000001' and is_cover),
  'the first photo is the cover'
);
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
    values ('00000000-0000-4000-9000-000000000001', 'extra/7.webp', 'image/webp', 1000, 100, 100)$$,
  'P0001',
  'listing_media.limit',
  'a seventh photo is refused'
);
select pg_temp.add_media('00000000-0000-4000-9000-000000000002', 1);
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, is_cover)
    values ('00000000-0000-4000-9000-000000000002', 'extra/cover.webp', 'image/webp', 1000, 100, 100, true)$$,
  '23505',
  null,
  'a second cover is refused'
);
delete from public.listing_media
where listing_id = '00000000-0000-4000-9000-000000000001' and is_cover;
select ok(
  (select position = 2 from public.listing_media
   where listing_id = '00000000-0000-4000-9000-000000000001' and is_cover),
  'deleting the cover promotes the next photo'
);

-- DB-CON-listing_media
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
    values ('00000000-0000-4000-9000-000000000002', 'bad/gif.gif', 'image/gif', 1000, 100, 100)$$,
  '23514',
  null,
  'only WebP, JPEG and PNG are accepted'
);
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
    values ('00000000-0000-4000-9000-000000000002', 'bad/big.webp', 'image/webp', 10485761, 100, 100)$$,
  '23514',
  null,
  'a photo over 10 MB is refused'
);
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
    values ('00000000-0000-4000-9000-000000000002', 'bad/flat.webp', 'image/webp', 1000, 0, 100)$$,
  '23514',
  null,
  'a photo needs a positive width'
);

-- DB-TRG-listing_media-review (policy C)
select pg_temp.add_media('00000000-0000-4000-9000-000000000003', 1);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000003'),
  'pending',
  'adding a photo to an approved listing sends it back to review'
);

-- Visitors
set local role anon;
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000006')::int,
  2,
  'anon sees the photos of an approved listing'
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001')::int,
  0,
  'anon does not see the photos of a draft'
);
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
    values ('00000000-0000-4000-9000-000000000006', 'anon/1.webp', 'image/webp', 1000, 100, 100)$$,
  '42501',
  null,
  'anon cannot insert photos'
);
reset role;

-- The owner, o1
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000001"}',
  true
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001')::int,
  5,
  'an owner sees the photos of their draft'
);
select throws_ok(
  $$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height)
    values ('00000000-0000-4000-9000-000000000001', 'own/1.webp', 'image/webp', 1000, 100, 100)$$,
  '42501',
  null,
  'an owner cannot insert photo rows directly'
);
select throws_ok(
  $$update public.listing_media set is_cover = true
    where listing_id = '00000000-0000-4000-9000-000000000001'$$,
  '42501',
  null,
  'an owner cannot change the cover directly'
);
select lives_ok(
  $$update public.listing_media set alt_text = 'Living room'
    where listing_id = '00000000-0000-4000-9000-000000000004'$$,
  'an owner can set alt text'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000004'),
  'approved',
  'setting alt text keeps the listing approved'
);
select lives_ok(
  $$delete from public.listing_media
    where id = (select id from public.listing_media
                where listing_id = '00000000-0000-4000-9000-000000000004' order by position limit 1)$$,
  'an owner can delete a photo'
);
select is(
  (select status from public.properties where id = '00000000-0000-4000-9000-000000000004'),
  'pending',
  'DEC-09: removing a photo sends an approved listing back to review'
);
select lives_ok(
  $$delete from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000005'$$,
  'deleting photos of a sold listing is accepted but matches no rows'
);

-- Another customer, o2
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "phone": "919100000002"}',
  true
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001')::int,
  0,
  'another customer does not see the photos of a draft'
);
select lives_ok(
  $$delete from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001'$$,
  'deleting another owner''s photos is accepted but matches no rows'
);
reset role;
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000001')::int,
  5,
  'the draft keeps its photos'
);
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000005')::int,
  1,
  'a sold listing keeps its photos'
);

-- The admin
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select cmp_ok(
  (select count(*) from public.listing_media)::int,
  '>=',
  10,
  'the admin sees every photo row'
);
select lives_ok(
  $$delete from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000005'$$,
  'the admin can delete photo rows'
);
reset role;
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000005')::int,
  0,
  'the admin deletion took effect'
);

-- Deleting a listing removes its photos
delete from public.properties where id = '00000000-0000-4000-9000-000000000002';
select is(
  (select count(*) from public.listing_media where listing_id = '00000000-0000-4000-9000-000000000002')::int,
  0,
  'deleting a listing deletes its photo rows'
);

select * from finish();
rollback;
