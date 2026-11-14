-- F11 retention (S7-T12 part 2, DEC-28, ADR-124; AI chat usage rows added by AI-P4-T05). Tests: DB-FN-run_retention, DB-PRIV-retention, DB-AUDIT-retention.
-- Old rows are made with a created_at well past each window and new ones well inside it, so the fixtures are the only
-- rows near a window's edge whatever else the database holds; a limited run, a second limited run and a full run show
-- the batches, and a rerun finds nothing.
begin;
select plan(18);

-- b1 is a builder with two projects' worth of leads (one project), a1 owns a listing the enquiries are about.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now());
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000002', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at)
values ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now());
insert into public.properties (
  id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
  locality, city, state, pincode, address
) values (
  '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'approved', 'sale', 'apartment',
  'Sea view apartment', 'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
  '600020', '12 Beach Road'
);

-- Form submissions (12 months): two that can go (one failed in the CRM, one not applicable), one new, one with an
-- uploaded file and one still waiting on a CRM delivery (both left alone).
insert into public.form_submissions (id, form_name, created_at, files, crm_status) values
  ('00000000-0000-4000-d000-000000000001', 'Contact', now() - interval '13 months', '[]', 'not_applicable'),
  ('00000000-0000-4000-d000-000000000002', 'Contact', now() - interval '14 months', '[]', 'failed'),
  ('00000000-0000-4000-d000-000000000003', 'Contact', now() - interval '11 months', '[]', 'not_applicable'),
  ('00000000-0000-4000-d000-000000000004', 'Contact', now() - interval '13 months', '["form-uploads/a.pdf"]', 'not_applicable'),
  ('00000000-0000-4000-d000-000000000005', 'Contact', now() - interval '13 months', '[]', 'pending');
-- CRM log lines (12 months): three old, one new.
insert into public.crm_api_logs (integration_name, outcome, created_at) values
  ('CRM', 'success', now() - interval '13 months'),
  ('CRM', 'failed', now() - interval '14 months'),
  ('CRM', 'success', now() - interval '15 months'),
  ('CRM', 'success', now() - interval '11 months');
-- Project events (12 months): two old, one new.
insert into public.project_events (project_id, event_type, visitor_hash, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('1', 40), now() - interval '13 months'),
  ('00000000-0000-4000-c000-000000000001', 'shortlist', repeat('2', 40), now() - interval '16 months'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('3', 40), now() - interval '11 months');
-- Enquiries and project leads (24 months): two old, one new each.
insert into public.enquiries (property_id, name, phone, created_at) values
  ('00000000-0000-4000-9000-000000000001', 'Meena S', '9841070011', now() - interval '25 months'),
  ('00000000-0000-4000-9000-000000000001', 'Lakshmi N', '9841070022', now() - interval '30 months'),
  ('00000000-0000-4000-9000-000000000001', 'Recent Sender', '9841070033', now() - interval '23 months');
insert into public.project_leads (project_id, kind, name, phone, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Arjun Menon', '9841055512', now() - interval '25 months'),
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Divya Krishnan', '9884021098', now() - interval '26 months'),
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Recent Lead', '9940188231', now() - interval '23 months');
-- Rate limit windows (7 days) and idempotency keys (24 hours): two old, one new each.
insert into public.public_rate_limits (scope, subject_hash, window_start, hits) values
  ('it_retention', 'aaaaaaaaaaaaaaaa', now() - interval '8 days', 3),
  ('it_retention', 'aaaaaaaaaaaaaaaa', now() - interval '30 days', 1),
  ('it_retention', 'aaaaaaaaaaaaaaaa', now() - interval '6 days', 2);
-- AI chat usage rows (12 months): two old, one new.
insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome) values
  ('it-retention-1', now() - interval '13 months', 'anonymous', 'it', 'answered'),
  ('it-retention-2', now() - interval '18 months', 'anonymous', 'it', 'refused'),
  ('it-retention-3', now() - interval '11 months', 'anonymous', 'it', 'answered');
insert into public.idempotency_keys (scope, subject, key, created_at) values
  ('it_retention', 'x', gen_random_uuid(), now() - interval '25 hours'),
  ('it_retention', 'x', gen_random_uuid(), now() - interval '3 days'),
  ('it_retention', 'x', gen_random_uuid(), now() - interval '23 hours');
-- An old audit entry: the log is never pruned.
insert into public.audit_log (at, actor_role, action, entity_type)
values (now() - interval '5 years', 'system', 'test.very_old', 'test');

create temp table mark (runs bigint not null);
insert into mark select count(*) from public.audit_log where action = 'retention.ran';

-- A limited run: at most two rows of a table, in one batch.
select is(
  public.run_retention(2, 1),
  '{"form_submissions": 2, "crm_api_logs": 2, "project_events": 2, "enquiries": 2, "project_leads": 2,
    "public_rate_limits": 2, "idempotency_keys": 2, "ai_usage_events": 2,
    "skipped": {"form_submissions_with_files": 1, "form_submissions_pending": 1}}'::jsonb,
  'a limited run deletes at most one batch of each table, and counts what it leaves alone'
);
select is(
  (select count(*) from public.crm_api_logs where integration_name = 'CRM' and created_at < now() - interval '12 months')::int,
  1, 'one old log line is left for the next run'
);
-- A second limited run in small batches goes on until nothing is left to delete or the batches run out.
select is(
  public.run_retention(1, 2) - 'skipped',
  '{"form_submissions": 0, "crm_api_logs": 1, "project_events": 0, "enquiries": 0, "project_leads": 0,
    "public_rate_limits": 0, "idempotency_keys": 0, "ai_usage_events": 0}'::jsonb,
  'the next run takes the rest, over as many small batches as it needs'
);
select is(
  public.run_retention(),
  '{"form_submissions": 0, "crm_api_logs": 0, "project_events": 0, "enquiries": 0, "project_leads": 0,
    "public_rate_limits": 0, "idempotency_keys": 0, "ai_usage_events": 0,
    "skipped": {"form_submissions_with_files": 1, "form_submissions_pending": 1}}'::jsonb,
  'a run with nothing left to delete deletes nothing, and still counts what it leaves alone'
);

-- What is left: the new rows, and the two submissions it must not delete.
select results_eq(
  $$select
      (select count(*) from public.form_submissions where form_name = 'Contact')::int,
      (select count(*) from public.crm_api_logs where integration_name = 'CRM')::int,
      (select count(*) from public.project_events where project_id = '00000000-0000-4000-c000-000000000001')::int,
      (select count(*) from public.enquiries where property_id = '00000000-0000-4000-9000-000000000001')::int,
      (select count(*) from public.project_leads where project_id = '00000000-0000-4000-c000-000000000001')::int,
      (select count(*) from public.public_rate_limits where scope = 'it_retention')::int,
      (select count(*) from public.idempotency_keys where scope = 'it_retention')::int,
      (select count(*) from public.ai_usage_events where prompt_version = 'it')::int$$,
  $$values (3, 1, 1, 1, 1, 1, 1, 1)$$,
  'only the new rows are left (and the submission with a file and the one still waiting stay)'
);
select is(
  (select count(*) from public.form_submissions
   where id in ('00000000-0000-4000-d000-000000000004', '00000000-0000-4000-d000-000000000005'))::int,
  2, 'a submission with an uploaded file, and one waiting on a CRM delivery, are not deleted however old'
);

-- The log of the runs, and that the log itself is not pruned
select is(
  (select count(*) from public.audit_log where action = 'retention.ran')::int - (select runs from mark)::int,
  3, 'each run writes one entry'
);
select results_eq(
  $$select actor_role, entity_type, entity_id from public.audit_log
    where action = 'retention.ran' order by id desc limit 1$$,
  $$values ('system'::text, 'retention'::text, null::text)$$,
  'a run is recorded as the system, with no subject'
);
select is(
  (select array_agg(key order by key) from jsonb_object_keys(
    (select diff from public.audit_log where action = 'retention.ran' order by id desc limit 1)
  ) as key),
  array['ai_usage_events', 'crm_api_logs', 'enquiries', 'form_submissions', 'idempotency_keys', 'project_events', 'project_leads',
        'public_rate_limits', 'skipped'],
  'an entry holds the counts of each table and of what was left alone'
);
select ok(
  (select diff::text !~ '[0-9a-f]{8}-[0-9a-f]{4}-' from public.audit_log where action = 'retention.ran' order by id desc limit 1),
  'an entry holds counts only: no id, name, number or message'
);
select ok(
  exists (select 1 from public.audit_log where action = 'test.very_old'),
  'the audit log is never pruned, however old an entry is'
);

-- The limits
select throws_ok(
  $$select public.run_retention(0, 1)$$, '22023', 'retention.bad_limits', 'a batch of no rows is refused'
);
select throws_ok(
  $$select public.run_retention(1, 0)$$, '22023', 'retention.bad_limits', 'no batches at all is refused'
);

-- Who may run it
set local role authenticated;
select throws_ok(
  $$select public.run_retention()$$, '42501', null, 'a signed-in user cannot run it'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.run_retention()$$, '42501', null, 'a visitor cannot run it'
);
reset role;
select ok(
  has_function_privilege('service_role', 'public.run_retention(integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.run_retention(integer, integer)', 'execute')
    and not has_function_privilege('anon', 'public.run_retention(integer, integer)', 'execute'),
  'only the service role may run it'
);
select is(
  (select prosecdef from pg_proc where proname = 'run_retention' and pronamespace = 'public'::regnamespace),
  true, 'it runs as its owner, so it needs no rights from the one who starts it'
);
select results_eq(
  $$select schedule, command from cron.job where jobname = 'retention'$$,
  $$values ('30 21 * * *'::text, 'select public.run_retention()'::text)$$,
  'it is scheduled every night at 03:00 in India (21:30 UTC)'
);

select * from finish();
rollback;
