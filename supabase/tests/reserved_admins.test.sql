-- F02 follow-up: two reserved admin addresses. Tests: DB-FN-reserved_admin_emails,
-- DB-TRG-super_admin-grant (both addresses), DB-TRG-user_roles-guard, DB-TRG-builders-reserved-email.
begin;
select plan(22);

-- The list and the yes-or-no question
select is(array_length(public.reserved_admin_emails(), 1), 2, 'there are two reserved admin addresses');
select ok(public.is_reserved_admin_email('support@drizzlemarketings.com'), 'the first address is reserved');
select ok(public.is_reserved_admin_email('developer@findsprop.com'), 'the second address is reserved');
select ok(public.is_reserved_admin_email('Developer@FindsProp.com'), 'the check ignores letter case');
select ok(not public.is_reserved_admin_email('other@example.test'), 'any other address is not reserved');
select ok(not public.is_reserved_admin_email(null), 'no address is not reserved');
select ok(not public.is_reserved_admin_email(''), 'an empty address is not reserved');
select ok(
  not has_function_privilege('authenticated', 'public.reserved_admin_emails()', 'execute'),
  'a signed-in user cannot read the list'
);
select ok(
  has_function_privilege('authenticated', 'public.is_reserved_admin_email(text)', 'execute'),
  'a signed-in user can only ask yes or no'
);
select hasnt_function('public', 'reserved_admin_email', 'the single-address function is gone');

-- Both addresses are granted super_admin when confirmed
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'other@example.test', now());
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-0000000000a2', 'developer@findsprop.com');

select ok(
  public.has_role('00000000-0000-4000-8000-0000000000a1', 'super_admin'),
  'the first address is super_admin from creation'
);
select ok(
  not public.has_role('00000000-0000-4000-8000-0000000000a2', 'super_admin'),
  'the second address is not super_admin until it is confirmed'
);
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a2', 'super_admin')$$,
  'P0001', 'user_roles.super_admin_reserved', 'an unconfirmed reserved address cannot be given the role by hand'
);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000000a2';
select ok(
  public.has_role('00000000-0000-4000-8000-0000000000a2', 'super_admin'),
  'confirming the second address grants super_admin'
);
select is(
  (select count(*) from public.user_roles
   where role = 'super_admin'
     and user_id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'))::int,
  2,
  'both admins hold the role at the same time'
);
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000c1', 'super_admin')$$,
  'P0001', 'user_roles.super_admin_reserved', 'nobody else can be given super_admin'
);

-- Neither address can become a builder (BR-35)
select throws_ok(
  $$insert into public.builders (email, name) values ('developer@findsprop.com', 'Dev Builder')$$,
  'P0001', 'builders.reserved_email', 'the second address cannot become a builder'
);
select throws_ok(
  $$insert into public.builders (email, name) values ('SUPPORT@drizzlemarketings.com', 'Support Builder')$$,
  'P0001', 'builders.reserved_email', 'the first address cannot become a builder, in any letter case'
);

-- The second admin really has admin powers, and the grant is recorded
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
select ok(public.is_super_admin(), 'is_super_admin is true for the second address');
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'role.granted' and entity_id = '00000000-0000-4000-8000-0000000000a2' and diff ->> 'role' = 'super_admin'
  ),
  'the second address''s grant is recorded in the audit log'
);
set local role authenticated;
select cmp_ok(
  (select count(*) from public.audit_log)::int,
  '>=',
  1,
  'the second admin can read the audit log'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*) from public.audit_log)::int, 0, 'any other account reads nothing from the audit log');
reset role;

select * from finish();
rollback;
