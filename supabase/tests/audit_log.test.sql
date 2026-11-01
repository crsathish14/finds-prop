-- F07 audit log. Tests: DB-TRG-audit-*, DB-CON-audit_log, DB-RLS-audit_log, DB-FN-audit_record.
begin;
select plan(49);

-- ad is the reserved admin, o1 owns a listing, b1 and b2 are builder users, c1 is a customer.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');

insert into public.properties (
  id, owner_id, status, listing_type, property_type, title, description, price, area_sqft, locality,
  city, state, pincode, address, location
) values (
  '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'approved', 'sale',
  'apartment', 'Sea view apartment', 'A bright flat near the sea.', 8500000, 950, 'Adyar', 'Chennai',
  'Tamil Nadu', '600020', '12 Beach Road',
  extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography
);
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at)
values (
  '00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista',
  '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()
);

create temp table audit_mark (label text primary key, total bigint not null);

-- Who is acting
select set_config('request.jwt.claims', '', true);
select is(public.audit_actor_role(), 'system', 'with no signed-in user the actor is the system');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select is(public.audit_actor_role(), 'super_admin', 'the admin is recorded as super_admin');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is(public.audit_actor_role(), 'builder', 'an active builder is recorded as builder');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is(public.audit_actor_role(), 'customer', 'anyone else signed in is recorded as customer');

-- The request id comes from a header the application sends
select set_config('request.headers', '{"x-request-id": "req-123"}', true);
select is(public.audit_request_id(), 'req-123', 'the request id is read from the header');
select set_config('request.headers', 'not json', true);
select is(public.audit_request_id(), null::text, 'a malformed header gives no request id');
select set_config('request.headers', '', true);
select is(public.audit_request_id(), null::text, 'no header gives no request id');

-- Listings: a status change is recorded with the actor and request id; other edits are not
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select set_config('request.headers', '{"x-request-id": "req-abc"}', true);
update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000001';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'listing.status_changed' and entity_id = '00000000-0000-4000-9000-000000000001'
      and actor_id = '00000000-0000-4000-8000-0000000000ad' and actor_role = 'super_admin'
      and diff ->> 'from' = 'approved' and diff ->> 'to' = 'pending' and request_id = 'req-abc'
  ),
  'a listing status change is recorded with the admin and the request id'
);
insert into audit_mark select 'before price edit', count(*) from public.audit_log;
update public.properties set price = 9000000 where id = '00000000-0000-4000-9000-000000000001';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark where label = 'before price edit'),
  'an edit that does not change the status is not recorded'
);
select set_config('request.jwt.claims', '', true);
select set_config('request.headers', '', true);
delete from public.properties where id = '00000000-0000-4000-9000-000000000001';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'listing.deleted' and entity_id = '00000000-0000-4000-9000-000000000001'
      and actor_id is null and actor_role = 'system' and diff ->> 'status' = 'pending'
  ),
  'a listing delete is recorded'
);

-- Projects
update public.projects set moderation = 'pending' where id = '00000000-0000-4000-c000-000000000001';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'project.moderation_changed' and entity_id = '00000000-0000-4000-c000-000000000001'
      and diff ->> 'from' = 'approved' and diff ->> 'to' = 'pending'
  ),
  'a project moderation change is recorded'
);
insert into audit_mark select 'before project edit', count(*) from public.audit_log;
update public.projects set description = 'A gated community.' where id = '00000000-0000-4000-c000-000000000001';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark where label = 'before project edit'),
  'a project edit that does not change moderation is not recorded'
);
delete from public.projects where id = '00000000-0000-4000-c000-000000000001';
select ok(
  exists (select 1 from public.audit_log where action = 'project.deleted' and entity_id = '00000000-0000-4000-c000-000000000001'),
  'a project delete is recorded'
);

-- Roles
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'role.granted' and entity_id = '00000000-0000-4000-8000-0000000000ad' and diff ->> 'role' = 'super_admin'
  ),
  'the reserved admin''s super_admin grant is recorded'
);
select ok(
  not exists (select 1 from public.audit_log where action = 'role.granted' and diff ->> 'role' = 'customer'),
  'the default customer role is not recorded'
);
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b2', 'builder');
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'role.granted' and entity_id = '00000000-0000-4000-8000-0000000000b2' and diff ->> 'role' = 'builder'
  ),
  'granting the builder role is recorded'
);
update public.user_roles set role = 'agent'
where user_id = '00000000-0000-4000-8000-0000000000b2' and role = 'builder';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'role.changed' and entity_id = '00000000-0000-4000-8000-0000000000b2'
      and diff ->> 'from' = 'builder' and diff ->> 'to' = 'agent'
  ),
  'changing a role is recorded'
);
delete from public.user_roles where user_id = '00000000-0000-4000-8000-0000000000b2' and role = 'agent';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'role.revoked' and entity_id = '00000000-0000-4000-8000-0000000000b2' and diff ->> 'role' = 'agent'
  ),
  'revoking a role is recorded'
);

-- Builders: the email address is never written down
select ok(
  exists (select 1 from public.audit_log where action = 'builder.created' and entity_id = '00000000-0000-4000-b000-000000000001'),
  'creating a builder is recorded'
);
update public.builders set active = false where id = '00000000-0000-4000-b000-000000000001';
select ok(
  exists (select 1 from public.audit_log where action = 'builder.deactivated' and entity_id = '00000000-0000-4000-b000-000000000001'),
  'deactivating a builder is recorded'
);
update public.builders set active = true where id = '00000000-0000-4000-b000-000000000001';
select ok(
  exists (select 1 from public.audit_log where action = 'builder.activated' and entity_id = '00000000-0000-4000-b000-000000000001'),
  'activating a builder is recorded'
);
update public.builders set email = 'builder1.new@example.test' where id = '00000000-0000-4000-b000-000000000001';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'builder.email_changed' and entity_id = '00000000-0000-4000-b000-000000000001' and diff = '{}'::jsonb
  ),
  'an email change is recorded as changed, without the address'
);

-- CRM: names of changed fields, never values
insert into public.crm_integrations (id, name, base_url)
values ('00000000-0000-4000-f000-000000000001', 'Sample CRM', 'https://api.crm.example');
select ok(
  exists (select 1 from public.audit_log where action = 'crm.created' and diff ->> 'name' = 'Sample CRM'),
  'creating an integration is recorded'
);
update public.crm_integrations set headers = '{"Authorization": "Bearer header-value-not-real"}'
where id = '00000000-0000-4000-f000-000000000001';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'crm.updated' and entity_id = '00000000-0000-4000-f000-000000000001' and diff -> 'changed' = '["headers"]'::jsonb
  ),
  'an integration edit records the changed field names'
);
insert into public.crm_integration_secrets (integration_id, api_key)
values ('00000000-0000-4000-f000-000000000001', 'key-value-not-real');
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'crm.secret_changed' and entity_id = '00000000-0000-4000-f000-000000000001' and diff -> 'set' = '["api_key"]'::jsonb
  ),
  'adding a secret records which secret, not its value'
);
update public.crm_integration_secrets set api_key = 'new-key-value-not-real', access_token = 'token-value-not-real'
where integration_id = '00000000-0000-4000-f000-000000000001';
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'crm.secret_changed' and diff -> 'changed' = '["access_token", "api_key"]'::jsonb
  ),
  'changing secrets records which ones changed, not their values'
);
select ok(
  not exists (select 1 from public.audit_log where diff::text like '%value-not-real%'),
  'no secret or header value appears anywhere in the log'
);
delete from public.crm_integrations where id = '00000000-0000-4000-f000-000000000001';
select ok(
  exists (select 1 from public.audit_log where action = 'crm.deleted' and diff ->> 'name' = 'Sample CRM'),
  'deleting an integration is recorded'
);

-- Forms and CMS settings
insert into public.forms (id, name, slug, kind)
values ('00000000-0000-4000-f100-000000000001', 'Standard enquiry form', 'enquiry', 'enquiry');
delete from public.forms where id = '00000000-0000-4000-f100-000000000001';
select ok(
  exists (select 1 from public.audit_log where action = 'form.deleted' and diff ->> 'name' = 'Standard enquiry form'),
  'deleting a form is recorded'
);
insert into public.site_settings (key, value) values ('hero', '{"title": "Find your home"}');
select ok(
  exists (select 1 from public.audit_log where action = 'cms.changed' and entity_id = 'hero' and diff = '{}'::jsonb),
  'publishing a setting records which one, not its content'
);
insert into audit_mark select 'before same value', count(*) from public.audit_log;
update public.site_settings set value = '{"title": "Find your home"}' where key = 'hero';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark where label = 'before same value'),
  'saving a setting with the same content is not recorded'
);
update public.site_settings set value = '{"title": "New title"}' where key = 'hero';
select is(
  (select count(*) from public.audit_log where action = 'cms.changed' and entity_id = 'hero')::int,
  2,
  'changing a setting is recorded'
);

-- audit_record: for events a trigger cannot see
select lives_ok(
  $$select public.audit_record(
      '00000000-0000-4000-8000-0000000000ad', 'super_admin', 'staff.signed_in', 'user',
      '00000000-0000-4000-8000-0000000000ad', '{}'::jsonb, 'req-777', 'abcdef0123456789')$$,
  'the service can record an event with an actor, request id and IP hash'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'staff.signed_in' and actor_role = 'super_admin' and request_id = 'req-777' and ip_hash = 'abcdef0123456789'
  ),
  'the recorded event holds what the service said'
);
select ok(
  not has_function_privilege('authenticated', 'public.audit_record(uuid, text, text, text, text, jsonb, text, text)', 'execute'),
  'a signed-in user cannot call audit_record'
);
select ok(
  has_function_privilege('service_role', 'public.audit_record(uuid, text, text, text, text, jsonb, text, text)', 'execute'),
  'the service role can call audit_record'
);

-- The log is append-only and constrained
select throws_ok(
  $$update public.audit_log set action = 'cms.edited'$$,
  'P0001', 'audit_log.append_only', 'an entry cannot be edited'
);
select throws_ok(
  $$delete from public.audit_log$$,
  'P0001', 'audit_log.append_only', 'an entry cannot be deleted'
);
select ok(
  not has_table_privilege('service_role', 'public.audit_log', 'INSERT')
    and not has_table_privilege('service_role', 'public.audit_log', 'UPDATE')
    and not has_table_privilege('service_role', 'public.audit_log', 'DELETE')
    and not has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE'),
  'the service role cannot write, change or empty the log directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'INSERT')
    and not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE')
    and not has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE'),
  'a signed-in user cannot write, change or empty the log'
);
select throws_ok(
  $$insert into public.audit_log (actor_role, action, entity_type) values ('system', 'Bad Action', 'x')$$,
  '23514', null, 'an action name is lower case words with dots'
);
select throws_ok(
  $$insert into public.audit_log (actor_role, action, entity_type) values ('hacker', 'cms.changed', 'x')$$,
  '23514', null, 'an actor role comes from the closed list'
);
select ok(
  not exists (select 1 from public.audit_log where diff::text like '%@%' or entity_id like '%@%'),
  'no email address appears anywhere in the log'
);

-- Only the admin reads it
set local role anon;
select throws_ok($$select * from public.audit_log$$, '42501', null, 'anon cannot read the log');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*) from public.audit_log)::int, 0, 'a customer sees no entries');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*) from public.audit_log)::int, 0, 'a builder sees no entries');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select cmp_ok((select count(*) from public.audit_log)::int, '>=', 10, 'the admin sees the entries');
select throws_ok(
  $$insert into public.audit_log (actor_role, action, entity_type) values ('super_admin', 'cms.changed', 'x')$$,
  '42501', null, 'not even the admin writes an entry from a client'
);
select throws_ok(
  $$update public.audit_log set action = 'cms.edited'$$,
  '42501', null, 'not even the admin edits an entry from a client'
);
reset role;

select * from finish();
rollback;
