-- F04 follow-up: builders.kind. Tests: DB-CON-builders-kind, DB-RLS-builders-kind, DB-TRG-builders-kind.
begin;
select plan(18);

-- b1 is a builder, b2 is an agent (same role, type agent), c1 is a customer, ad is the reserved admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'agent1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name, kind) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes', 'builder'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'agent1@example.test', 'Meena Properties', 'agent');

-- DB-CON-builders-kind
select is(
  (select kind from public.builders where id = '00000000-0000-4000-b000-000000000001'),
  'builder',
  'the type is builder unless said otherwise'
);
select lives_ok(
  $$insert into public.builders (email, name) values ('default@example.test', 'Default Type')$$,
  'a builder can be created without naming a type'
);
select is(
  (select kind from public.builders where email = 'default@example.test'),
  'builder',
  'the default type is builder'
);
select throws_ok(
  $$insert into public.builders (email, name, kind) values ('partner@example.test', 'Partner Co', 'partner')$$,
  '23514', null, 'the type is builder or agent'
);

-- An agent works exactly like a builder
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}', true);
select is(
  public.current_builder_id(),
  '00000000-0000-4000-b000-000000000002'::uuid,
  'an agent resolves to their record like a builder does'
);
select is(
  (select kind from public.my_builder()),
  'agent',
  'an agent can read their own type through my_builder'
);
select lives_ok(
  $$update public.builders set description = 'Agents for new launches.' where id = '00000000-0000-4000-b000-000000000002'$$,
  'an agent can edit their own profile'
);
select throws_ok(
  $$update public.builders set kind = 'builder' where id = '00000000-0000-4000-b000-000000000002'$$,
  '42501', null, 'an agent cannot change their own type'
);
reset role;

-- The type is private
set local role anon;
select throws_ok($$select kind from public.builders$$, '42501', null, 'a visitor cannot read the type');
select lives_ok(
  $$select id, name, logo_url, website, description from public.builders$$,
  'a visitor can still read the public profile columns'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok($$select kind from public.builders$$, '42501', null, 'a customer cannot read the type');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select is(
  (select kind from public.admin_builders() where id = '00000000-0000-4000-b000-000000000002'),
  'agent',
  'the admin sees the type through admin_builders'
);
select cmp_ok(
  (select count(*) from public.admin_builders() where kind = 'builder')::int,
  '>=',
  1,
  'the admin can tell builders from agents'
);
reset role;

-- Defence in depth: the guard still refuses if a grant were ever widened
grant update (kind) on public.builders to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$update public.builders set kind = 'agent' where id = '00000000-0000-4000-b000-000000000001'$$,
  'P0001', 'builders.admin_only_columns', 'the guard refuses a builder changing their type'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select lives_ok(
  $$update public.builders set kind = 'agent' where id = '00000000-0000-4000-b000-000000000001'$$,
  'the guard lets the admin change the type'
);
reset role;

-- DB-TRG-builders-kind: the audit log
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'builder.kind_changed' and entity_id = '00000000-0000-4000-b000-000000000001'
      and diff ->> 'from' = 'builder' and diff ->> 'to' = 'agent'
  ),
  'a change of type is recorded'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'builder.created' and entity_id = '00000000-0000-4000-b000-000000000002' and diff ->> 'kind' = 'agent'
  ),
  'creating an agent records the type'
);
select ok(
  not exists (select 1 from public.audit_log where diff::text like '%@%'),
  'no email address appears in the log'
);

select * from finish();
rollback;
