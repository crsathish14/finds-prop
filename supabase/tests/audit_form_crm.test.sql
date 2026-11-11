-- F07 follow-up: the audit log records which CRM connection a form sends to (S7-T12, ADR-123).
-- Tests: DB-TRG-audit-form-crm, DB-PRIV-audit-form-crm.
begin;
select plan(13);

-- ad is the reserved admin; two CRM connections and a form to move between them.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.crm_integrations (id, name, base_url) values
  ('00000000-0000-4000-f000-000000000001', 'First CRM', 'https://crm-one.example.test'),
  ('00000000-0000-4000-f000-000000000002', 'Second CRM', 'https://crm-two.example.test');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- The entries of one form, numbered from the oldest, as (n, from, to).
create function pg_temp.crm_entries(form uuid)
returns table (n bigint, from_id text, to_id text)
language sql
as $$
  select row_number() over (order by id), diff ->> 'from', diff ->> 'to'
  from public.audit_log
  where action = 'form.crm_changed' and entity_id = form::text
$$;

-- A form made with no connection writes nothing.
insert into public.forms (id, name, slug, kind)
values ('00000000-0000-4000-f100-000000000001', 'Contact form', 'contact-form', 'contact');
select is(
  (select count(*) from pg_temp.crm_entries('00000000-0000-4000-f100-000000000001'))::int, 0,
  'a form made with no connection is not recorded'
);

-- Linked, pointed at another, and unlinked.
update public.forms set crm_integration_id = '00000000-0000-4000-f000-000000000001'
where id = '00000000-0000-4000-f100-000000000001';
select results_eq(
  $$select from_id, to_id from pg_temp.crm_entries('00000000-0000-4000-f100-000000000001') where n = 1$$,
  $$values (null::text, '00000000-0000-4000-f000-000000000001'::text)$$,
  'linking a form to a connection is recorded, from none to that connection'
);
update public.forms set crm_integration_id = '00000000-0000-4000-f000-000000000002'
where id = '00000000-0000-4000-f100-000000000001';
select results_eq(
  $$select from_id, to_id from pg_temp.crm_entries('00000000-0000-4000-f100-000000000001') where n = 2$$,
  $$values ('00000000-0000-4000-f000-000000000001'::text, '00000000-0000-4000-f000-000000000002'::text)$$,
  'pointing it at another connection is recorded, with the old and the new'
);
update public.forms set crm_integration_id = null where id = '00000000-0000-4000-f100-000000000001';
select results_eq(
  $$select from_id, to_id from pg_temp.crm_entries('00000000-0000-4000-f100-000000000001') where n = 3$$,
  $$values ('00000000-0000-4000-f000-000000000002'::text, null::text)$$,
  'unlinking it is recorded, with the connection it left'
);

-- Changes that do not move the form are not recorded.
update public.forms set name = 'Contact us form', button_text = 'Send' where id = '00000000-0000-4000-f100-000000000001';
update public.forms set crm_integration_id = null where id = '00000000-0000-4000-f100-000000000001';
select is(
  (select count(*) from pg_temp.crm_entries('00000000-0000-4000-f100-000000000001'))::int, 3,
  'saving the form with the same connection, or other changes, writes nothing'
);

-- A form made already linked.
insert into public.forms (id, name, slug, kind, crm_integration_id)
values ('00000000-0000-4000-f100-000000000002', 'Enquiry form', 'enquiry-form', 'enquiry', '00000000-0000-4000-f000-000000000001');
select results_eq(
  $$select from_id, to_id from pg_temp.crm_entries('00000000-0000-4000-f100-000000000002') where n = 1$$,
  $$values (null::text, '00000000-0000-4000-f000-000000000001'::text)$$,
  'a form made already linked is recorded, from none to that connection'
);

-- Deleting a connection unlinks its forms, and each is recorded.
delete from public.crm_integrations where id = '00000000-0000-4000-f000-000000000001';
select results_eq(
  $$select from_id, to_id from pg_temp.crm_entries('00000000-0000-4000-f100-000000000002') where n = 2$$,
  $$values ('00000000-0000-4000-f000-000000000001'::text, null::text)$$,
  'deleting a connection records each form it unlinked'
);

-- What an entry holds
select is(
  (select array_agg(key order by key) from jsonb_object_keys(
    (select diff from public.audit_log
     where action = 'form.crm_changed' and entity_id = '00000000-0000-4000-f100-000000000001'
     order by id limit 1)
  ) as key),
  array['from', 'to'],
  'an entry holds only the old and the new connection, nothing from the form or the connection'
);
select is(
  (select count(*) from public.audit_log
   where action = 'form.crm_changed' and entity_type = 'form'
     and actor_role = 'super_admin' and actor_id = '00000000-0000-4000-8000-0000000000ad'
     and entity_id in ('00000000-0000-4000-f100-000000000001', '00000000-0000-4000-f100-000000000002'))::int,
  (select count(*) from public.audit_log where action = 'form.crm_changed'
   and entity_id in ('00000000-0000-4000-f100-000000000001', '00000000-0000-4000-f100-000000000002'))::int,
  'every entry names the form and the admin who made the change'
);
select is(
  (select count(*) from public.audit_log
   where action = 'form.crm_changed'
     and entity_id in ('00000000-0000-4000-f100-000000000001', '00000000-0000-4000-f100-000000000002')
     and diff::text ~* 'crm-one|crm-two|First CRM|Second CRM|Contact|Enquiry')::int,
  0, 'no name or address from a form or a connection reaches the log'
);

-- Who may run it
select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name = 'audit_form_crm'
     and grantee in ('PUBLIC', 'anon', 'authenticated'))::int,
  0, 'the trigger function is not granted to the public, visitors or signed-in users'
);
select is(
  (select prosecdef from pg_proc where proname = 'audit_form_crm' and pronamespace = 'public'::regnamespace),
  true, 'it runs as its owner, so a form editor needs no right to write the log'
);
select is(
  (select count(*) from pg_trigger where tgrelid = 'public.forms'::regclass and tgname like 'forms_audit_crm_%')::int,
  2, 'a trigger for a form made linked and one for a link that changes'
);

select * from finish();
rollback;
