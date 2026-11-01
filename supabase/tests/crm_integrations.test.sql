-- F05 CRM. Tests: DB-RLS-secrets-denied (BR-64), DB-CON-crm_integrations, DB-RLS-crm_integrations,
-- DB-FN-arm_crm_retry (BR-66), DB-RLS-internal_cron_tokens (BR-67).
begin;
select plan(29);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

insert into public.crm_integrations (id, name, base_url, endpoint, method)
values ('00000000-0000-4000-f000-000000000001', 'Sample CRM', 'https://api.crm.example', '/v2/leads', 'POST');
insert into public.crm_integration_secrets (integration_id, api_key, access_token)
values ('00000000-0000-4000-f000-000000000001', 'test-key-not-real', 'test-token-not-real');

-- DB-CON-crm_integrations (BR-65: https only; the private-address check lives in the application)
select throws_ok(
  $$insert into public.crm_integrations (name, base_url) values ('Plain Http', 'http://api.crm.example')$$,
  '23514', null, 'a CRM base URL must be https'
);
select throws_ok(
  $$insert into public.crm_integrations (name, base_url, method) values ('Wrong Method', 'https://api.crm.example', 'GET')$$,
  '23514', null, 'a CRM method is POST or PUT'
);
select throws_ok(
  $$insert into public.crm_integrations (name, base_url, endpoint) values ('Bad Endpoint', 'https://api.crm.example', 'no-slash')$$,
  '23514', null, 'a CRM endpoint is a path starting with a slash'
);
select throws_ok(
  $$insert into public.crm_integrations (name, base_url, headers) values ('Bad Headers', 'https://api.crm.example', '[]')$$,
  '23514', null, 'CRM headers are an object'
);
select throws_ok(
  $$insert into public.internal_cron_tokens (name, token) values ('crm_retry', 'too-short')$$,
  '23514', null, 'a job token is at least 32 characters'
);

-- DB-RLS-secrets-denied
set local role anon;
select throws_ok($$select * from public.crm_integrations$$, '42501', null, 'anon cannot read integrations');
select throws_ok($$select * from public.crm_integration_secrets$$, '42501', null, 'anon cannot read secrets');
select throws_ok($$select * from public.internal_cron_tokens$$, '42501', null, 'anon cannot read job tokens');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*) from public.crm_integrations)::int, 0, 'a customer sees no integrations');
select throws_ok(
  $$insert into public.crm_integrations (name, base_url) values ('Customer CRM', 'https://api.crm.example')$$,
  '42501', null, 'a customer cannot create an integration'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*) from public.crm_integrations)::int, 0, 'a builder sees no integrations');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select is((select count(*) from public.crm_integrations)::int, 1, 'the admin sees the integrations');
select throws_ok(
  $$select * from public.crm_integration_secrets$$,
  '42501', null, 'BR-64: even the admin cannot read the secrets'
);
select throws_ok(
  $$select * from public.internal_cron_tokens$$,
  '42501', null, 'BR-67: even the admin cannot read the job tokens'
);
select lives_ok(
  $$insert into public.crm_integrations (name, base_url, endpoint) values ('Backup CRM', 'https://hooks.backup.example', '/lead')$$,
  'the admin can create an integration'
);
select lives_ok(
  $$update public.crm_integrations set active = false where name = 'Backup CRM'$$,
  'the admin can edit an integration'
);
select lives_ok(
  $$delete from public.crm_integrations where name = 'Backup CRM'$$,
  'the admin can delete an integration'
);
reset role;

-- The service role reaches the secrets (and nothing else does)
set local role service_role;
select is(
  (select count(*) from public.crm_integration_secrets)::int,
  1,
  'the service role can read the secrets'
);
reset role;

-- DB-FN-arm_crm_retry (BR-66)
select throws_ok(
  $$select public.arm_crm_retry()$$,
  'P0001', 'crm_retry.not_configured', 'arming needs the public URL and the job token to be set'
);
insert into public.app_config (key, value) values ('app.public_url', 'https://dev.example.test');
insert into public.internal_cron_tokens (name, token)
values ('crm_retry', 'test-token-not-real-0123456789abcdef');
select lives_ok($$select public.arm_crm_retry()$$, 'arming schedules the retry job');
select ok(
  exists (select 1 from cron.job where jobname = 'crm-retry'),
  'the retry job exists after arming'
);
select lives_ok($$select public.arm_crm_retry()$$, 'arming twice replaces the job');
select is(
  (select count(*) from cron.job where jobname = 'crm-retry')::int,
  1,
  'there is only one retry job'
);
select lives_ok($$select public.disarm_crm_retry()$$, 'disarming removes the retry job');
select ok(
  not exists (select 1 from cron.job where jobname = 'crm-retry'),
  'the retry job is gone after disarming'
);
select lives_ok($$select public.disarm_crm_retry()$$, 'disarming when nothing is scheduled is harmless');
select ok(
  not has_function_privilege('authenticated', 'public.arm_crm_retry()', 'execute'),
  'a signed-in user cannot arm the job'
);
select ok(
  has_function_privilege('service_role', 'public.arm_crm_retry()', 'execute'),
  'the service role can arm the job'
);

-- Deleting an integration deletes its secrets
delete from public.crm_integrations where id = '00000000-0000-4000-f000-000000000001';
select is(
  (select count(*) from public.crm_integration_secrets)::int,
  0,
  'deleting an integration deletes its secrets'
);

select * from finish();
rollback;
