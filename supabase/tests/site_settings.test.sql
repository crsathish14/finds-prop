-- F03 site_settings. Tests: DB-RLS-site_settings, DB-CON-site_settings.
begin;
select plan(11);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', '919000000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.site_settings (key, value) values ('hero', '{"title": "Find your home"}');

-- Anyone can read
set local role anon;
select is(
  (select value ->> 'title' from public.site_settings where key = 'hero'),
  'Find your home',
  'anon can read site settings'
);
select throws_ok(
  $$insert into public.site_settings (key, value) values ('footer', '{}')$$,
  '42501',
  null,
  'anon cannot write site settings'
);
reset role;

-- A customer reads but cannot write
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919000000001"}',
  true
);
select is(
  (select count(*) from public.site_settings)::int,
  1,
  'a customer can read site settings'
);
select throws_ok(
  $$insert into public.site_settings (key, value) values ('footer', '{}')$$,
  '42501',
  null,
  'a customer cannot insert a setting'
);
select lives_ok(
  $$update public.site_settings set value = '{"title": "Hacked"}' where key = 'hero'$$,
  'a customer update is accepted but matches no rows'
);
reset role;
select is(
  (select value ->> 'title' from public.site_settings where key = 'hero'),
  'Find your home',
  'the setting is unchanged after the customer update'
);

-- The super admin writes
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select lives_ok(
  $$insert into public.site_settings (key, value) values ('footer', '{"about": "x"}')$$,
  'the super admin can insert a setting'
);
select lives_ok(
  $$update public.site_settings set value = '{"title": "New title"}' where key = 'hero'$$,
  'the super admin can update a setting'
);
reset role;
select is(
  (select value ->> 'title' from public.site_settings where key = 'hero'),
  'New title',
  'the update is stored'
);

-- DB-CON-site_settings
select throws_ok(
  $$insert into public.site_settings (key, value) values ('bad', '[1]')$$,
  '23514',
  null,
  'a setting value must be a JSON object'
);
select throws_ok(
  $$insert into public.site_settings (key, value) values ('Bad Key', '{}')$$,
  '23514',
  null,
  'a setting key must be lower snake case'
);

select * from finish();
rollback;
