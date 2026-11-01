-- F04 builders. Tests: DB-FN-current_builder_id, DB-RLS-builders-*, DB-TRG-builders-guard,
-- DB-TRG-builders-reserved-email, DB-CON-builders.
begin;
select plan(34);

-- Users: b1, b2 and b3 have a builder record; b3 lacks the builder role; bi is deactivated;
-- c1 is a customer with no builder record; ad is the reserved admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b3', 'builder3@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b4', 'builder4@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder'),
  ('00000000-0000-4000-8000-0000000000b4', 'builder');

insert into public.builders (id, user_id, email, name, phone, active) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes', '9840012345', true),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', 'Nila Habitats', null, true),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-8000-0000000000b3', 'builder3@example.test', 'Thendral Estates', null, true),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-8000-0000000000b4', 'builder4@example.test', 'Closed Builders', null, false);

-- DB-CON-builders and DB-TRG-builders-reserved-email (BR-35)
select throws_ok(
  $$insert into public.builders (email, name) values ('support@drizzlemarketings.com', 'Reserved Builder')$$,
  'P0001',
  'builders.reserved_email',
  'BR-35: the reserved admin address cannot become a builder'
);
select throws_ok(
  $$insert into public.builders (email, name) values ('Support@DrizzleMarketings.com', 'Reserved Builder')$$,
  'P0001',
  'builders.reserved_email',
  'BR-35: the reserved address is matched without regard to case'
);
select throws_ok(
  $$insert into public.builders (email, name) values ('BUILDER1@example.test', 'Duplicate')$$,
  '23505',
  null,
  'a builder email is unique without regard to case'
);
select throws_ok(
  $$insert into public.builders (email, name, phone) values ('p@example.test', 'Phone Test', 'abc')$$,
  '23514',
  null,
  'a phone number is digits only'
);
select throws_ok(
  $$insert into public.builders (email, name, logo_url) values ('l@example.test', 'Logo Test', 'http://example.test/logo.png')$$,
  '23514',
  null,
  'a logo link must be https'
);

-- DB-FN-current_builder_id (BR-30, BR-33, BR-34)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is(
  public.current_builder_id(),
  '00000000-0000-4000-b000-000000000001'::uuid,
  'an active builder with the builder role resolves to their record'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated"}', true);
select is(
  public.current_builder_id(),
  null::uuid,
  'an active record without the builder role resolves to nothing'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b4", "role": "authenticated"}', true);
select is(
  public.current_builder_id(),
  null::uuid,
  'BR-33: a deactivated builder resolves to nothing'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is(
  public.current_builder_id(),
  null::uuid,
  'a customer with no builder record resolves to nothing'
);
select is((select count(*) from public.my_builder())::int, 0, 'my_builder is empty for a customer');
reset role;

-- Visitors
set local role anon;
select is(
  (select count(*) from public.builders)::int,
  3,
  'anon sees only active builders'
);
select lives_ok(
  $$select id, name, logo_url, website, description from public.builders$$,
  'anon can read the public profile columns'
);
select throws_ok($$select email from public.builders$$, '42501', null, 'anon cannot read the email');
select throws_ok($$select phone from public.builders$$, '42501', null, 'anon cannot read the phone');
select throws_ok($$select user_id from public.builders$$, '42501', null, 'anon cannot read the user link');
select throws_ok($$select * from public.builders$$, '42501', null, 'anon cannot select every column');
select throws_ok(
  $$insert into public.builders (email, name) values ('x@example.test', 'Anon Builder')$$,
  '42501',
  null,
  'anon cannot insert'
);
reset role;

-- A builder, b1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is(
  (select email from public.my_builder()),
  'builder1@example.test',
  'my_builder returns the full record, including the email'
);
select lives_ok(
  $$update public.builders set name = 'Kadal Homes Ltd', description = 'Homes by the sea.'
    where id = '00000000-0000-4000-b000-000000000001'$$,
  'a builder can edit their own profile'
);
select is(
  (select name from public.builders where id = '00000000-0000-4000-b000-000000000001'),
  'Kadal Homes Ltd',
  'the profile change is stored'
);
select lives_ok(
  $$update public.builders set name = 'Hijacked' where id = '00000000-0000-4000-b000-000000000002'$$,
  'editing another builder is accepted but matches no rows'
);
select throws_ok(
  $$update public.builders set active = false where id = '00000000-0000-4000-b000-000000000001'$$,
  '42501',
  null,
  'BR-32: a builder cannot change their own active flag'
);
select throws_ok(
  $$update public.builders set email = 'new@example.test' where id = '00000000-0000-4000-b000-000000000001'$$,
  '42501',
  null,
  'BR-32: a builder cannot change their own email'
);
select throws_ok(
  $$delete from public.builders where id = '00000000-0000-4000-b000-000000000001'$$,
  '42501',
  null,
  'builders are never deleted'
);
reset role;
select is(
  (select name from public.builders where id = '00000000-0000-4000-b000-000000000002'),
  'Nila Habitats',
  'the other builder''s name is unchanged'
);

-- A deactivated builder, bi
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b4", "role": "authenticated"}', true);
select lives_ok(
  $$update public.builders set name = 'Still Here' where id = '00000000-0000-4000-b000-000000000004'$$,
  'a deactivated builder update is accepted but matches no rows'
);
select is((select count(*) from public.my_builder())::int, 0, 'a deactivated builder has no record to read');
reset role;
select is(
  (select name from public.builders where id = '00000000-0000-4000-b000-000000000004'),
  'Closed Builders',
  'a deactivated builder cannot edit their profile'
);

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select cmp_ok((select count(*) from public.admin_builders())::int, '>=', 4, 'the admin reads every builder, active or not');
select lives_ok(
  $$update public.builders set contact_person = 'Meena' where id = '00000000-0000-4000-b000-000000000002'$$,
  'the admin can edit a builder profile'
);
select throws_ok(
  $$update public.builders set active = false where id = '00000000-0000-4000-b000-000000000002'$$,
  '42501',
  null,
  'activating and deactivating goes through the service role, not a client grant'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*) from public.admin_builders())::int, 0, 'admin_builders is empty for a builder');
reset role;

-- Defence in depth: the guard still refuses if a grant were ever widened
grant update (active, email) on public.builders to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$update public.builders set active = false where id = '00000000-0000-4000-b000-000000000001'$$,
  'P0001',
  'builders.admin_only_columns',
  'the guard refuses a builder changing account columns'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select lives_ok(
  $$update public.builders set active = false where id = '00000000-0000-4000-b000-000000000002'$$,
  'the guard allows the admin to change account columns'
);
reset role;

select * from finish();
rollback;
