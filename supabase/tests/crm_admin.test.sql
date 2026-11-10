-- F05 follow-up: the admin's CRM connections (S7-T09). Tests: DB-FN-save_crm_integration, DB-FN-admin_crm_integrations,
-- DB-PRIV-crm-admin, DB-RLS-secrets-denied (BR-64), DB-AUDIT-crm (secret names only, never values).
begin;
select plan(41);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- A new connection with two secrets
select isnt(
  public.save_crm_integration(
    '{"name": "Sample CRM", "lead_source": "Find Prop", "base_url": "https://api.crm-vendor.com", "endpoint": "/v2/leads",
      "method": "POST", "lead_id_path": "data.lead.id", "active": true,
      "headers": {"Authorization": "Bearer {{access_token}}"}, "body_mapping": {"fullName": "{{name}}"},
      "project_codes": {"00000000-0000-4000-b000-000000000001": "KV-01"}}'::jsonb,
    null,
    '{"api_key": "api-key-value-not-real", "access_token": "access-token-value-not-real"}'::jsonb
  ),
  null::uuid, 'saving a new connection answers its id'
);
select results_eq(
  $$select name, lead_source, base_url, endpoint, method, lead_id_path, active
    from public.crm_integrations where name = 'Sample CRM'$$,
  $$values ('Sample CRM', 'Find Prop', 'https://api.crm-vendor.com', '/v2/leads', 'POST', 'data.lead.id', true)$$,
  'the settings are stored'
);
select results_eq(
  $$select headers, body_mapping, project_codes from public.crm_integrations where name = 'Sample CRM'$$,
  $$values (
    '{"Authorization": "Bearer {{access_token}}"}'::jsonb,
    '{"fullName": "{{name}}"}'::jsonb,
    '{"00000000-0000-4000-b000-000000000001": "KV-01"}'::jsonb
  )$$,
  'with the headers, the body mapping and the project codes'
);
select results_eq(
  $$select has_api_key, has_api_secret, has_access_token, forms
    from public.admin_crm_integrations() where name = 'Sample CRM'$$,
  $$values (true, false, true, 0::bigint)$$,
  'the list says which secrets are set, and how many forms send to it'
);
select is(
  position('value-not-real' in (select coalesce(jsonb_agg(to_jsonb(entry))::text, '') from public.admin_crm_integrations() as entry)),
  0, 'BR-64: the list holds no secret value'
);
select throws_ok(
  $$select * from public.crm_integration_secrets$$, '42501', null,
  'BR-64: even the admin cannot read the secrets table'
);

-- The audit log: the connection, and the names of the secrets, never their values
select is(
  (select count(*) from public.audit_log where action = 'crm.created')::int,
  1, 'the audit log records the new connection'
);
select results_eq(
  $$select actor_id, actor_role from public.audit_log where action = 'crm.created'$$,
  $$values ('00000000-0000-4000-8000-0000000000ad'::uuid, 'super_admin')$$,
  'with the admin as the actor, not the system'
);
select results_eq(
  $$select actor_id, actor_role, diff from public.audit_log where action = 'crm.secret_changed'$$,
  $$values ('00000000-0000-4000-8000-0000000000ad'::uuid, 'super_admin', '{"set": ["access_token", "api_key"]}'::jsonb)$$,
  'the secrets set are recorded by name, with the admin as the actor'
);
select is(
  (select count(*) from public.audit_log where diff::text like '%value-not-real%')::int,
  0, 'no secret value is in the audit log'
);

-- Changing it: a secret left out keeps its value
select public.save_crm_integration(
  '{"name": "Sample CRM", "base_url": "https://api.crm-vendor.com", "method": "PUT"}'::jsonb,
  (select id from public.crm_integrations where name = 'Sample CRM'),
  '{}'::jsonb
);
select results_eq(
  $$select method, lead_source, endpoint, active, headers, body_mapping
    from public.crm_integrations where name = 'Sample CRM'$$,
  $$values ('PUT', null, null, true, '{}'::jsonb, '{}'::jsonb)$$,
  'a save replaces the settings (what the screen did not send is cleared)'
);
select results_eq(
  $$select has_api_key, has_access_token from public.admin_crm_integrations() where name = 'Sample CRM'$$,
  $$values (true, true)$$,
  'and keeps the secrets it was not given'
);
select is(
  (select count(*) from public.audit_log where action = 'crm.secret_changed')::int,
  1, 'a save that changes no secret writes no secret entry'
);

-- Text sets a secret, null clears one
select public.save_crm_integration(
  '{"name": "Sample CRM", "base_url": "https://api.crm-vendor.com", "method": "PUT"}'::jsonb,
  (select id from public.crm_integrations where name = 'Sample CRM'),
  '{"api_key": "new-api-key-value-not-real", "access_token": null, "api_secret": "api-secret-value-not-real"}'::jsonb
);
select results_eq(
  $$select has_api_key, has_api_secret, has_access_token from public.admin_crm_integrations() where name = 'Sample CRM'$$,
  $$values (true, true, false)$$,
  'text sets a secret and null clears one'
);
select is(
  (select (diff -> 'changed') @> '["access_token", "api_key", "api_secret"]'::jsonb
     and jsonb_array_length(diff -> 'changed') = 3
   from public.audit_log where action = 'crm.secret_changed' and diff ? 'changed'),
  true, 'the audit entry names the three secrets that changed'
);
select is(
  (select count(*) from public.audit_log where diff::text like '%value-not-real%')::int,
  0, 'and still holds no secret value'
);

-- Clearing a secret that was never stored writes nothing
select public.save_crm_integration(
  '{"name": "Backup CRM", "base_url": "https://hooks.backup.io/lead", "method": "POST", "active": false}'::jsonb,
  null,
  '{"api_key": null}'::jsonb
);
select is(
  (select count(*) from public.audit_log
   where action = 'crm.secret_changed'
     and entity_id = (select id::text from public.crm_integrations where name = 'Backup CRM'))::int,
  0, 'clearing a secret that was never stored leaves no audit entry'
);
select results_eq(
  $$select active, has_api_key, has_api_secret, has_access_token
    from public.admin_crm_integrations() where name = 'Backup CRM'$$,
  $$values (false, false, false, false)$$,
  'an inactive connection with no secrets is listed as such'
);

-- A form that sends to it is counted
insert into public.forms (name, slug, kind, crm_integration_id)
select 'CRM Admin Form', 'crm-admin-form', 'enquiry', id from public.crm_integrations where name = 'Sample CRM';
select is(
  (select forms from public.admin_crm_integrations() where name = 'Sample CRM'),
  1::bigint, 'the list counts the forms that send to a connection'
);
select is(
  (select count(*) from public.admin_crm_integrations())::int,
  2, 'and lists both connections'
);

-- Refusals; a refused save changes nothing
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "https://a.example.com", "method": "POST"}'::jsonb, null, '{"password": "x-not-real"}'::jsonb)$$,
  '22023', 'crm.bad_secret', 'a secret of a name it does not know is refused'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "https://a.example.com", "method": "POST"}'::jsonb, null, '{"api_key": 5}'::jsonb)$$,
  '22023', 'crm.bad_secret', 'a secret that is not text is refused'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "https://a.example.com", "method": "POST"}'::jsonb, null, '{"api_key": ""}'::jsonb)$$,
  '22023', 'crm.bad_secret', 'an empty secret is refused (clearing is null)'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "https://a.example.com", "method": "POST"}'::jsonb, null, jsonb_build_object('api_key', repeat('k', 2001)))$$,
  '22023', 'crm.bad_secret', 'a secret over 2000 characters is refused'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "https://a.example.com", "method": "POST"}'::jsonb, null, '[]'::jsonb)$$,
  '22023', 'crm.bad_value', 'secrets that are not an object are refused'
);
select throws_ok(
  $$select public.save_crm_integration('[]'::jsonb, null, '{}'::jsonb)$$,
  '22023', 'crm.bad_value', 'settings that are not an object are refused'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "http://a.example.com", "method": "POST"}'::jsonb, null, '{}'::jsonb)$$,
  '23514', null, 'the table''s own checks still apply: an address must be https'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Bad", "base_url": "https://a.example.com", "method": "GET"}'::jsonb, null, '{}'::jsonb)$$,
  '23514', null, 'and the method is POST or PUT'
);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Ghost", "base_url": "https://a.example.com", "method": "POST"}'::jsonb, '00000000-0000-4000-a000-0000000000ff', '{}'::jsonb)$$,
  'P0002', 'crm.not_found', 'a connection that does not exist is not found'
);
select is(
  (select count(*) from public.crm_integrations)::int,
  2, 'no refused save left a connection behind'
);

-- Deleting: the form is kept and unlinked, the secrets go with it, and the log says so
select lives_ok(
  $$delete from public.crm_integrations where name = 'Sample CRM'$$,
  'the admin can delete a connection'
);
select is(
  (select crm_integration_id is null from public.admin_forms() where slug = 'crm-admin-form'),
  true, 'the form that sent to it stays, unlinked'
);
select is(
  (select count(*) from public.audit_log where action = 'crm.deleted')::int,
  1, 'the audit log records the deletion'
);

-- A customer and a builder are refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Mine", "base_url": "https://a.example.com", "method": "POST"}'::jsonb)$$,
  '42501', 'crm.not_allowed', 'a customer cannot save a connection'
);
select throws_ok(
  $$select * from public.admin_crm_integrations()$$,
  '42501', 'crm.not_allowed', 'a customer cannot list the connections'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.save_crm_integration('{"name": "Mine", "base_url": "https://a.example.com", "method": "POST"}'::jsonb)$$,
  '42501', 'crm.not_allowed', 'a builder cannot save a connection'
);
select throws_ok(
  $$select * from public.admin_crm_integrations()$$,
  '42501', 'crm.not_allowed', 'a builder cannot list the connections'
);
reset role;

-- A visitor has no execute grant at all
set local role anon;
select throws_ok(
  $$select public.save_crm_integration('{"name": "Mine", "base_url": "https://a.example.com", "method": "POST"}'::jsonb)$$,
  '42501', null, 'a visitor cannot call the save function (no execute grant)'
);
select throws_ok(
  $$select * from public.admin_crm_integrations()$$,
  '42501', null, 'a visitor cannot call the list function (no execute grant)'
);
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name in ('save_crm_integration', 'admin_crm_integrations')
     and grantee in ('PUBLIC', 'anon'))::int,
  0, 'neither function is granted to the public or to visitors'
);
select is(
  (select count(*) from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('save_crm_integration', 'admin_crm_integrations') and prosecdef)::int,
  2, 'both are definer functions, so they can reach the secrets the admin cannot read'
);

select * from finish();
