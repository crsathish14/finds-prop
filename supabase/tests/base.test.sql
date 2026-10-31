-- F01 base. Tests: DB-CON-app_role, extensions, app_config denied, touch_updated_at.
begin;
select plan(8);

select has_extension('postgis', 'postgis is installed');
select has_extension('pg_cron', 'pg_cron is installed');
select has_extension('pg_net', 'pg_net is installed');

-- DB-CON-app_role (BR-10, BR-14)
select enum_has_labels(
  'public',
  'app_role',
  array['super_admin', 'agent', 'builder', 'customer'],
  'app_role has exactly the four roles, in order'
);

-- app_config is service-role only
insert into public.app_config (key, value, updated_at) values ('test.value', 'one', '2000-01-01');

set local role anon;
select throws_ok($$select * from public.app_config$$, '42501', null, 'anon cannot read app_config');

reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.app_config$$,
  '42501',
  null,
  'authenticated cannot read app_config'
);
select throws_ok(
  $$insert into public.app_config (key, value) values ('test.other', 'x')$$,
  '42501',
  null,
  'authenticated cannot write app_config'
);

-- touch_updated_at
reset role;
update public.app_config set value = 'two' where key = 'test.value';
select cmp_ok(
  (select updated_at from public.app_config where key = 'test.value'),
  '>',
  '2000-01-01'::timestamptz,
  'updating a row refreshes updated_at'
);

select * from finish();
rollback;
