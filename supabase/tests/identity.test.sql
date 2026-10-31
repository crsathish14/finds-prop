-- F02 identity. Tests: DB-TRG-handle_new_user, DB-TRG-super_admin-grant, DB-TRG-user_roles-guard,
-- DB-RLS-profiles, DB-RLS-user_roles-*, DB-FN-roles.
begin;
select plan(41);

-- Fixtures. u1 signs in by phone only, u2 and u3 have an email, ad is the reserved admin.
--   u1 = ...0001, u2 = ...0002, u3 = ...0003, ad = ...00ad
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000001',
  '919000000001',
  now(),
  '{"full_name": "Test One"}'
);
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000002', 'two@example.test', now());
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000003', 'three@example.test');

-- DB-TRG-handle_new_user (BR-02, BR-03): a phone-only user, no email
select is(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'Test One',
  'a profile is created with the name from the sign-up metadata'
);
select is(
  (select phone from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  '+919000000001',
  'the phone is stored in E.164 form'
);
select is(
  (select count(*) from public.user_roles where user_id = '00000000-0000-4000-8000-000000000001')::int,
  1,
  'a new user gets exactly one role'
);
select ok(
  public.has_role('00000000-0000-4000-8000-000000000001', 'customer'),
  'the role is customer'
);
select ok(
  (select email_verified_at is null from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'a phone-only user has no verified email'
);
select ok(
  (select email_verified_at is not null from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'a confirmed email is mirrored to the profile'
);

-- The mirror follows later changes
update auth.users
set email_confirmed_at = now(), phone = '919000000009'
where id = '00000000-0000-4000-8000-000000000003';
select ok(
  (select email_verified_at is not null from public.profiles where id = '00000000-0000-4000-8000-000000000003'),
  'confirming an email updates the profile'
);
select is(
  (select phone from public.profiles where id = '00000000-0000-4000-8000-000000000003'),
  '+919000000009',
  'attaching a phone updates the profile'
);

-- DB-TRG-super_admin-grant (BR-11, BR-12)
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com');
select ok(
  not public.has_role('00000000-0000-4000-8000-0000000000ad', 'super_admin'),
  'the reserved address is not super_admin until it is confirmed'
);
update auth.users set email_confirmed_at = now()
where id = '00000000-0000-4000-8000-0000000000ad';
select ok(
  public.has_role('00000000-0000-4000-8000-0000000000ad', 'super_admin'),
  'confirming the reserved address grants super_admin'
);
delete from auth.users where id = '00000000-0000-4000-8000-0000000000ad';
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
select ok(
  public.has_role('00000000-0000-4000-8000-0000000000ad', 'super_admin'),
  'a confirmed reserved address is super_admin from creation'
);
select ok(
  not public.has_role('00000000-0000-4000-8000-000000000002', 'super_admin'),
  'any other account is not super_admin'
);

-- DB-TRG-user_roles-guard (BR-11)
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000002', 'super_admin')$$,
  'P0001',
  'user_roles.super_admin_reserved',
  'super_admin cannot be inserted for another account'
);
select throws_ok(
  $$update public.user_roles set role = 'super_admin' where user_id = '00000000-0000-4000-8000-000000000002'$$,
  'P0001',
  'user_roles.super_admin_reserved',
  'a role cannot be changed to super_admin for another account'
);

-- DB-FN-roles
select ok(
  not public.has_role('00000000-0000-4000-8000-000000000002', 'builder'),
  'has_role is false for a role the user does not hold'
);
select ok(
  not has_function_privilege('anon', 'public.has_role(uuid, public.app_role)', 'execute'),
  'anon cannot execute has_role'
);
select ok(
  not has_function_privilege('anon', 'public.is_super_admin()', 'execute'),
  'anon cannot execute is_super_admin'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'nobody can call the sign-up trigger function directly'
);

-- As the admin
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select ok(public.is_super_admin(), 'is_super_admin is true for the admin');
select ok(not public.has_verified_phone(), 'a token without a phone claim has no verified phone');
select cmp_ok(
  (select count(*) from public.profiles)::int,
  '>=',
  4,
  'DB-RLS-profiles: the admin sees every profile'
);
select cmp_ok(
  (select count(*) from public.user_roles)::int,
  '>=',
  5,
  'DB-RLS-user_roles: the admin sees every role'
);
select lives_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000002', 'builder')$$,
  'the admin can grant the builder role'
);
select lives_ok(
  $$delete from public.user_roles where user_id = '00000000-0000-4000-8000-0000000000ad' and role = 'super_admin'$$,
  'deleting a super_admin row is accepted but matches no rows'
);
select lives_ok(
  $$update public.user_roles set role = 'agent' where user_id = '00000000-0000-4000-8000-0000000000ad' and role = 'super_admin'$$,
  'changing a super_admin row is accepted but matches no rows'
);
reset role;
select ok(
  public.has_role('00000000-0000-4000-8000-000000000002', 'builder'),
  'the granted builder role exists'
);
select ok(
  public.has_role('00000000-0000-4000-8000-0000000000ad', 'super_admin'),
  'BR-13: the admin cannot remove or change a super_admin row'
);

-- As the phone-only customer
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919000000001"}',
  true
);
select ok(public.has_verified_phone(), 'a token with a phone claim has a verified phone');
select ok(not public.is_super_admin(), 'is_super_admin is false for a customer');
select is(
  (select count(*) from public.profiles)::int,
  1,
  'DB-RLS-profiles: a customer sees only their own profile'
);
select is(
  (select count(*) from public.user_roles)::int,
  1,
  'DB-RLS-user_roles: a customer sees only their own roles'
);
select lives_ok(
  $$update public.profiles set full_name = 'Renamed' where id = '00000000-0000-4000-8000-000000000001'$$,
  'a customer can change their own name'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'Renamed',
  'the name changed'
);
select throws_ok(
  $$update public.profiles set phone = '+919111111111' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a customer cannot change their phone mirror'
);
select throws_ok(
  $$update public.profiles set email_verified_at = now() where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a customer cannot mark their email verified'
);
select lives_ok(
  $$update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-8000-000000000002'$$,
  'updating another profile is accepted but matches no rows'
);
select throws_ok(
  $$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501',
  null,
  'a customer cannot create a profile'
);
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000001', 'builder')$$,
  '42501',
  null,
  'a customer cannot grant themselves a role'
);
reset role;
select is(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  null::text,
  'another customer''s profile is unchanged'
);

-- As a visitor
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.user_roles$$, '42501', null, 'anon cannot read roles');
reset role;

select * from finish();
rollback;
