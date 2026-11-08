-- F04 follow-up: the admin's list of builders (S7-T05). Tests: DB-FN-admin_builder_overview, DB-PRIV-admin-builders.
begin;
select plan(11);

-- ad is the reserved admin; b1 is a builder who has signed in, b2 one who has not; c1 is a customer.
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now(), '2026-11-07 09:40:00+00');
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b2', 'hello@thendralestates.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name, kind, invited_at) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes', 'builder', now() - interval '3 days'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'hello@thendralestates.example', 'Thendral Estates', 'agent', now());
update public.builders set active = false where id = '00000000-0000-4000-b000-000000000002';
-- Distinct creation times, so "newest first" has an answer.
update public.builders set created_at = now() - interval '2 days' where id = '00000000-0000-4000-b000-000000000001';

-- Kadal Homes has two projects; the first has two leads, the second one.
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-000000000002', 'kadal-sky', 'Kadal Sky', '00000000-0000-4000-b000-000000000001', 'Adyar', 'approved', true, now());
insert into public.project_leads (project_id, kind, name, phone) values
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Arjun Menon', '9841055512'),
  ('00000000-0000-4000-c000-000000000001', 'brochure', 'Divya Krishnan', '9884021098'),
  ('00000000-0000-4000-c000-000000000002', 'enquiry', 'Karthik Suresh', '9789044120');

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

select is((select count(*) from public.admin_builder_overview())::int, 2, 'the admin sees every builder, inactive ones too');
select results_eq(
  $$select name, kind, active, projects::int, leads::int from public.admin_builder_overview() order by name$$,
  $$values ('Kadal Homes', 'builder', true, 2, 3), ('Thendral Estates', 'agent', false, 0, 0)$$,
  'with the type, the active flag and the counts of projects and of leads over every project'
);
select results_eq(
  $$select name, last_sign_in_at is null from public.admin_builder_overview() order by name$$,
  $$values ('Kadal Homes', false), ('Thendral Estates', true)$$,
  'with the last sign-in, empty for a builder who has never signed in'
);
select is(
  (select email from public.admin_builder_overview() where name = 'Kadal Homes'),
  'sales@kadalhomes.example', 'the private email is included for the admin'
);
select is(
  (select name from public.admin_builder_overview() limit 1), 'Thendral Estates',
  'the newest builder comes first'
);

-- Anyone else is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.admin_builder_overview()$$, '42501', 'builder.not_allowed',
  'a builder cannot read the list of builders'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select * from public.admin_builder_overview()$$, '42501', 'builder.not_allowed',
  'a customer cannot read it'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.admin_builder_overview()$$, '42501', null, 'a visitor cannot call it (no execute grant)'
);
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name = 'admin_builder_overview'
     and grantee in ('PUBLIC', 'anon'))::int,
  0, 'the function is not granted to the public or to visitors'
);
select is(
  (select prosecdef from pg_proc where proname = 'admin_builder_overview' and pronamespace = 'public'::regnamespace),
  true, 'the function is a definer function, so it can read the last sign-in'
);
select is(
  (select count(*) from public.builders)::int, 2, 'reading the list changed nothing'
);

select * from finish();
rollback;
