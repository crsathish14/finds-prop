-- F05 follow-up: the CRM delivery state machine (S7-T09 part B1). Tests: DB-FN-claim_crm_deliveries (due rules, lease,
-- inactive and deleted connections, a named submission), DB-FN-record_crm_delivery (BR-66 states and log line),
-- DB-PRIV-crm-delivery (service role only).
begin;
select plan(53);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now());
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');
insert into public.projects (id, slug, name, builder_id, locality) values
  ('00000000-0000-4000-b000-0000000000a1', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur');

insert into public.crm_integrations (id, name, base_url, active) values
  ('00000000-0000-4000-a000-0000000000a1', 'Sample CRM', 'https://api.crm-vendor.com', true),
  ('00000000-0000-4000-a000-0000000000a2', 'Backup CRM', 'https://hooks.backup.io', false);

-- s1 pending and old (due); s2 pending and new (not due, but can be named); s3 failed and due; s4 failed, due later;
-- s5 pending on an inactive connection; s6 pending, connection deleted; s7 already sent; s8 pending but leased;
-- s9 failed for good (six attempts).
insert into public.form_submissions
  (id, form_name, project_id, crm_integration_id, crm_status, crm_attempts, next_retry_at, crm_claimed_until,
   name, mobile, email, data, source, created_at)
values
  ('00000000-0000-4000-a000-000000000001', 'Enquiry form', '00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-a000-0000000000a1',
   'pending', 0, null, null, 'Priya', '9840012345', 'priya@example.test', '{"message": "hello"}', '/projects/kadal-vista', now() - interval '5 minutes'),
  ('00000000-0000-4000-a000-000000000002', 'Contact', null, '00000000-0000-4000-a000-0000000000a1',
   'pending', 0, null, null, 'New', '9840012346', null, '{}', null, now()),
  ('00000000-0000-4000-a000-000000000003', 'Contact', null, '00000000-0000-4000-a000-0000000000a1',
   'failed', 2, now() - interval '1 minute', null, 'Retry', '9840012347', null, '{}', null, now() - interval '10 minutes'),
  ('00000000-0000-4000-a000-000000000004', 'Contact', null, '00000000-0000-4000-a000-0000000000a1',
   'failed', 2, now() + interval '10 minutes', null, 'Later', '9840012348', null, '{}', null, now() - interval '20 minutes'),
  ('00000000-0000-4000-a000-000000000005', 'Contact', null, '00000000-0000-4000-a000-0000000000a2',
   'pending', 0, null, null, 'Inactive', '9840012349', null, '{}', null, now() - interval '30 minutes'),
  ('00000000-0000-4000-a000-000000000006', 'Contact', null, null,
   'pending', 0, null, null, 'Gone', '9840012350', null, '{}', null, now() - interval '30 minutes'),
  ('00000000-0000-4000-a000-000000000007', 'Contact', null, '00000000-0000-4000-a000-0000000000a1',
   'success', 1, null, null, 'Sent', '9840012351', null, '{}', null, now() - interval '30 minutes'),
  ('00000000-0000-4000-a000-000000000008', 'Contact', null, '00000000-0000-4000-a000-0000000000a1',
   'pending', 0, null, now() + interval '3 minutes', 'Leased', '9840012352', null, '{}', null, now() - interval '30 minutes'),
  ('00000000-0000-4000-a000-000000000009', 'Contact', null, '00000000-0000-4000-a000-0000000000a1',
   'failed', 6, null, null, 'Final', '9840012353', null, '{}', null, now() - interval '40 minutes');

-- The sweep: what is due now
create temp table first_run as select * from public.claim_crm_deliveries(10);

select results_eq(
  $$select submission_id, attempt from first_run order by submission_id$$,
  $$values ('00000000-0000-4000-a000-000000000001'::uuid, 1::smallint), ('00000000-0000-4000-a000-000000000003'::uuid, 3::smallint)$$,
  'the sweep takes a pending submission over a minute old, and a failed one whose retry time has come, with the number of the attempt'
);
select results_eq(
  $$select integration_id, form_name, project_name, project_slug, name, mobile, email, data, source
    from first_run where submission_id = '00000000-0000-4000-a000-000000000001'$$,
  $$values ('00000000-0000-4000-a000-0000000000a1'::uuid, 'Enquiry form', 'Kadal Vista', 'kadal-vista', 'Priya', '9840012345',
            'priya@example.test', '{"message": "hello"}'::jsonb, '/projects/kadal-vista')$$,
  'and what the sender needs, with the project''s name and address'
);
select is(
  (select project_name from first_run where submission_id = '00000000-0000-4000-a000-000000000003'), null,
  'a submission with no project has none'
);
select ok(
  (select bool_and(crm_claimed_until > now() + interval '4 minutes' and crm_claimed_until <= now() + interval '5 minutes')
   from public.form_submissions where id in ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')),
  'each is leased for five minutes'
);
select is(
  (select next_retry_at is not null and next_retry_at < now() from public.form_submissions where id = '00000000-0000-4000-a000-000000000003'),
  true, 'the lease leaves the real retry time alone'
);
select is(
  (select count(*) from public.claim_crm_deliveries(10))::int, 0,
  'a second sweep right away takes nothing: the leased ones are not sent twice'
);
select results_eq(
  $$select crm_status, crm_claimed_until is not null from public.form_submissions where id = '00000000-0000-4000-a000-000000000002'$$,
  $$values ('pending', false)$$,
  'a pending submission under a minute old is left for the immediate send'
);
select results_eq(
  $$select crm_status, next_retry_at is not null, crm_attempts from public.form_submissions where id = '00000000-0000-4000-a000-000000000004'$$,
  $$values ('failed', true, 2::smallint)$$,
  'a failed submission whose time has not come is left alone'
);
select results_eq(
  $$select crm_status, crm_claimed_until is null from public.form_submissions where id = '00000000-0000-4000-a000-000000000005'$$,
  $$values ('pending', true)$$,
  'a submission on an inactive connection waits: not sent, not lost'
);
select results_eq(
  $$select crm_status, last_error, next_retry_at is null from public.form_submissions where id = '00000000-0000-4000-a000-000000000006'$$,
  $$values ('not_applicable', 'The connection was deleted.', true)$$,
  'a submission whose connection was deleted can never be sent, and says why'
);
select results_eq(
  $$select crm_status, crm_attempts, crm_claimed_until is null from public.form_submissions where id = '00000000-0000-4000-a000-000000000007'$$,
  $$values ('success', 1::smallint, true)$$,
  'a submission already sent is never touched'
);
select is(
  (select crm_claimed_until > now() + interval '2 minutes' and crm_claimed_until <= now() + interval '3 minutes'
   from public.form_submissions where id = '00000000-0000-4000-a000-000000000008'),
  true, 'a submission under someone else''s lease keeps that lease'
);
select is(
  (select count(*) from public.form_submissions where id = '00000000-0000-4000-a000-000000000009' and crm_claimed_until is null)::int, 1,
  'a submission that failed for good is not swept'
);

-- The limit
insert into public.form_submissions (id, form_name, crm_integration_id, crm_status, created_at) values
  ('00000000-0000-4000-a000-000000000010', 'Contact', '00000000-0000-4000-a000-0000000000a1', 'pending', now() - interval '60 minutes'),
  ('00000000-0000-4000-a000-000000000011', 'Contact', '00000000-0000-4000-a000-0000000000a1', 'pending', now() - interval '59 minutes');
select results_eq(
  $$select submission_id from public.claim_crm_deliveries(1)$$,
  $$values ('00000000-0000-4000-a000-000000000010'::uuid)$$,
  'the limit is kept, oldest first'
);
select results_eq(
  $$select submission_id from public.claim_crm_deliveries(5)$$,
  $$values ('00000000-0000-4000-a000-000000000011'::uuid)$$,
  'and the rest follow'
);
select throws_ok($$select * from public.claim_crm_deliveries(0)$$, '22023', 'crm.bad_limit', 'a limit of zero is refused');
select throws_ok($$select * from public.claim_crm_deliveries(51)$$, '22023', 'crm.bad_limit', 'a limit over fifty is refused');

-- A named submission: "send now"
select results_eq(
  $$select submission_id, attempt from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-000000000002')$$,
  $$values ('00000000-0000-4000-a000-000000000002'::uuid, 1::smallint)$$,
  'a new submission can be named and sent at once'
);
select is(
  (select count(*) from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-000000000002'))::int, 0,
  'but not twice while it is leased'
);
select results_eq(
  $$select submission_id, attempt from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-000000000004')$$,
  $$values ('00000000-0000-4000-a000-000000000004'::uuid, 1::smallint)$$,
  'a failed submission can be sent before its time, and the schedule starts again'
);
select results_eq(
  $$select crm_attempts, next_retry_at is not null from public.form_submissions where id = '00000000-0000-4000-a000-000000000004'$$,
  $$values (0::smallint, true)$$,
  'with the attempts back to none'
);
select results_eq(
  $$select submission_id, attempt from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-000000000009')$$,
  $$values ('00000000-0000-4000-a000-000000000009'::uuid, 1::smallint)$$,
  'a submission that failed for good can be sent again by name, as attempt 1'
);
select is(
  (select count(*) from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-000000000007'))::int, 0,
  'a submission already sent cannot be named'
);
select is(
  (select count(*) from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-000000000005'))::int, 0,
  'nor one on an inactive connection'
);
select is(
  (select count(*) from public.claim_crm_deliveries(1, '00000000-0000-4000-a000-0000000000ff'))::int, 0,
  'nor one that does not exist'
);
select is(
  (select crm_status from public.form_submissions where id = '00000000-0000-4000-a000-000000000006'), 'not_applicable',
  'naming a submission does not run the clean-up (it stays as the sweep left it)'
);

-- Recording a result
select is(
  public.record_crm_delivery('00000000-0000-4000-a000-000000000001', 'Sample CRM', 1, true, 200, '{"ok":true,"lead_id":"CRM-4821"}', 'CRM-4821'),
  'success', 'a success is recorded as success'
);
select results_eq(
  $$select crm_status, crm_attempts, crm_http_status, crm_lead_id, next_retry_at is null, last_error is null, crm_claimed_until is null
    from public.form_submissions where id = '00000000-0000-4000-a000-000000000001'$$,
  $$values ('success', 1::smallint, 200::smallint, 'CRM-4821', true, true, true)$$,
  'with the lead id kept, no retry, no error, and the lease released'
);
select results_eq(
  $$select integration_id, integration_name, form_name, outcome, http_status, attempt, response_snippet
    from public.crm_api_logs where submission_id = '00000000-0000-4000-a000-000000000001'$$,
  $$values ('00000000-0000-4000-a000-0000000000a1'::uuid, 'Sample CRM', 'Enquiry form', 'success', 200::smallint, 1::smallint,
            '{"ok":true,"lead_id":"CRM-4821"}')$$,
  'and one log line for the call'
);

select is(
  public.record_crm_delivery('00000000-0000-4000-a000-000000000003', 'Sample CRM', 3, false, 502, 'Bad gateway: upstream timed out', null, now() + interval '30 minutes'),
  'failed', 'a failure is recorded as failed'
);
select results_eq(
  $$select crm_status, crm_attempts, crm_http_status, last_error, crm_lead_id is null, crm_claimed_until is null,
            next_retry_at > now() + interval '29 minutes' and next_retry_at <= now() + interval '30 minutes'
    from public.form_submissions where id = '00000000-0000-4000-a000-000000000003'$$,
  $$values ('failed', 3::smallint, 502::smallint, 'Bad gateway: upstream timed out', true, true, true)$$,
  'with the reason, the next try at the time the server chose, and the lease released'
);
select results_eq(
  $$select outcome, attempt, http_status from public.crm_api_logs where submission_id = '00000000-0000-4000-a000-000000000003'$$,
  $$values ('failed', 3::smallint, 502::smallint)$$,
  'and one log line'
);

select is(
  public.record_crm_delivery('00000000-0000-4000-a000-000000000009', 'Sample CRM', 6, false, null, '', null, now() + interval '1 hour'),
  'failed', 'the sixth failure is recorded as failed'
);
select results_eq(
  $$select next_retry_at is null, last_error, crm_http_status is null
    from public.form_submissions where id = '00000000-0000-4000-a000-000000000009'$$,
  $$values (true, 'The CRM did not accept the lead.', true)$$,
  'with no next try whatever time was given, a plain reason when there was no answer, and no status'
);

select is(
  public.record_crm_delivery('00000000-0000-4000-a000-000000000010', '  ', 1, false, 99, repeat('x', 900), null, now() + interval '1 minute'),
  'failed', 'a failure with an odd status, a long answer and no CRM name is still recorded'
);
select results_eq(
  $$select crm_http_status is null, char_length(last_error) from public.form_submissions where id = '00000000-0000-4000-a000-000000000010'$$,
  $$values (true, 500)$$,
  'a status outside 100 to 599 is dropped and the answer is cut to 500 characters'
);
select results_eq(
  $$select integration_name, http_status is null, char_length(response_snippet)
    from public.crm_api_logs where submission_id = '00000000-0000-4000-a000-000000000010'$$,
  $$values ('CRM', true, 500)$$,
  'the log line has a default name for the CRM and the same cuts'
);

-- Refusals
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 2, false, 500, 'x', null, null)$$,
  '22023', 'crm.bad_retry_time', 'a failure before the last attempt needs a next time'
);
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 2, false, 500, 'x', null, now() + interval '2 days')$$,
  '22023', 'crm.bad_retry_time', 'a next time more than a day away is refused'
);
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 2, false, 500, 'x', null, now() - interval '1 hour')$$,
  '22023', 'crm.bad_retry_time', 'and one in the past'
);
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 0, true)$$,
  '22023', 'crm.bad_attempt', 'attempt 0 is refused'
);
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 7, true)$$,
  '22023', 'crm.bad_attempt', 'attempt 7 is refused'
);
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 1, null)$$,
  '22023', 'crm.bad_attempt', 'a result that is neither success nor failure is refused'
);
select throws_ok(
  $$select public.record_crm_delivery('00000000-0000-4000-a000-0000000000ff', 'Sample CRM', 1, true)$$,
  'P0002', 'crm.submission_not_found', 'a submission that does not exist is not found'
);
select is(
  (select count(*) from public.crm_api_logs where submission_id = '00000000-0000-4000-a000-000000000011')::int, 0,
  'a refused result leaves no log line'
);

-- Privileges: the service role only
set local role anon;
select throws_ok($$select * from public.claim_crm_deliveries(1)$$, '42501', null, 'a visitor cannot claim');
select throws_ok($$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'x', 1, true)$$, '42501', null, 'a visitor cannot record');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok($$select * from public.claim_crm_deliveries(1)$$, '42501', null, 'a signed-in user cannot claim');
select throws_ok($$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'x', 1, true)$$, '42501', null, 'a signed-in user cannot record');
reset role;
set local role service_role;
select lives_ok($$select * from public.claim_crm_deliveries(1)$$, 'the service role can claim');
select lives_ok($$select public.record_crm_delivery('00000000-0000-4000-a000-000000000011', 'Sample CRM', 1, true)$$, 'and record');
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name in ('claim_crm_deliveries', 'record_crm_delivery')
     and grantee in ('PUBLIC', 'anon', 'authenticated'))::int,
  0, 'neither function is granted to the public, to visitors or to signed-in users'
);
select is(
  (select count(*) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('claim_crm_deliveries', 'record_crm_delivery') and prosecdef)::int,
  2, 'both are definer functions'
);

select * from finish();
