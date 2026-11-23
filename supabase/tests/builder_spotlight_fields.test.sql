-- Builder spotlight fields (ADR-179). Tests: DB-builder-spotlight-columns, DB-STO-builder-logos.
-- The tagline, year started, projects delivered and logo path are public, kept within their limits, written by the
-- builder on their own row (or by the admin), and the logo can only point into the builder's own folder of the
-- `builder-logos` bucket, where only that builder or the admin may write. Fictional data only.
begin;
select plan(18);

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

-- DB-builder-spotlight-columns: the limits
select throws_ok(
  $$update public.builders set tagline = repeat('a', 101) where id = '00000000-0000-4000-b000-000000000001'$$,
  '23514', null, 'a tagline longer than 100 characters is refused'
);
select throws_ok(
  $$update public.builders set tagline = '   ' where id = '00000000-0000-4000-b000-000000000001'$$,
  '23514', null, 'a blank tagline is refused (an empty box is stored as nothing)'
);
select throws_ok(
  $$update public.builders set established_year = 1850 where id = '00000000-0000-4000-b000-000000000001'$$,
  '23514', null, 'a year before 1900 is refused'
);
select throws_ok(
  $$update public.builders set projects_delivered = -1 where id = '00000000-0000-4000-b000-000000000001'$$,
  '23514', null, 'a negative count of delivered projects is refused'
);
select throws_ok(
  $$update public.builders set logo_path = '00000000-0000-4000-b000-000000000002/logo.png'
    where id = '00000000-0000-4000-b000-000000000001'$$,
  '23514', null, 'a logo in another builder''s folder is refused'
);
select throws_ok(
  $$update public.builders set logo_path = '00000000-0000-4000-b000-000000000001/logo.svg'
    where id = '00000000-0000-4000-b000-000000000001'$$,
  '23514', null, 'a logo that is not a JPG, PNG or WEBP is refused'
);

-- The builder fills their own profile; another builder cannot touch it
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.builders
    set tagline = 'Lake-side homes in south Chennai', established_year = 2001, projects_delivered = 42,
        logo_path = '00000000-0000-4000-b000-000000000001/logo-1.webp'
    where id = '00000000-0000-4000-b000-000000000001'$$,
  'a builder can fill the spotlight fields of their own profile'
);
reset role;
select is(
  (select projects_delivered from public.builders where id = '00000000-0000-4000-b000-000000000001'),
  42,
  'and the change is kept'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}', true);
set local role authenticated;
update public.builders set projects_delivered = 1 where id = '00000000-0000-4000-b000-000000000001';
reset role;
select is(
  (select projects_delivered from public.builders where id = '00000000-0000-4000-b000-000000000001'),
  42,
  'another builder cannot change them'
);

-- Visitors read them with the rest of the public profile
set local role anon;
select results_eq(
  $$select tagline, established_year::int, projects_delivered, logo_path from public.builders
    where id = '00000000-0000-4000-b000-000000000001'$$,
  $$values ('Lake-side homes in south Chennai'::text, 2001, 42, '00000000-0000-4000-b000-000000000001/logo-1.webp'::text)$$,
  'a visitor can read the spotlight fields'
);
reset role;

-- DB-STO-builder-logos
select is(
  (select array[public::text, file_size_limit::text] from storage.buckets where id = 'builder-logos'),
  array['true', '1048576'],
  'the logo bucket is public and limited to 1 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'builder-logos'),
  array['image/webp', 'image/jpeg', 'image/png'],
  'the logo bucket takes only WEBP, JPG and PNG'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select ok(
  public.storage_builder_logo_path_ok('00000000-0000-4000-b000-000000000001/logo.webp'),
  'a builder may write in their own logo folder'
);
select ok(
  not public.storage_builder_logo_path_ok('00000000-0000-4000-b000-000000000002/logo.webp'),
  'another builder''s logo folder is refused'
);
select ok(
  not public.storage_builder_logo_path_ok('00000000-0000-4000-b000-000000000001/extra/logo.webp'),
  'a deeper folder is refused'
);
select ok(not public.storage_builder_logo_path_ok('logo.webp'), 'a path without a builder folder is refused');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select ok(
  public.storage_builder_logo_path_ok('00000000-0000-4000-b000-000000000002/logo.webp'),
  'the admin may write in any builder''s logo folder'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select ok(
  not public.storage_builder_logo_path_ok('00000000-0000-4000-b000-000000000001/logo.webp'),
  'a customer may not write in a logo folder'
);

select * from finish();
rollback;
