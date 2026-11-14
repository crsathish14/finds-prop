-- AI chat P4-T05 (ADR-128 section 8, decision D8 option A): usage metadata, one row per customer message.
-- Tests: DB-RLS-ai-usage-denied, DB-CHK-ai-usage-no-text, DB-FK-ai-usage-user, DB-PRIV-ai-usage-service-only.
begin;
select plan(22);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

-- The service role writes and reads it; a full row and a minimal row both go in.
set local role service_role;
select lives_ok(
  $$insert into public.ai_usage_events (
      request_id, occurred_at, caller, user_id, provider, model, prompt_version, outcome, limited_by,
      input_tags, output_tags, output_counts, number_ungrounded, rounds, retried, tool_calls_per_round, tools_ran,
      input_tokens, output_tokens, cached_input_tokens, agent_limit, fallback_reason, duration_ms
    ) values (
      'req-signed-in', now(), 'signed_in', '00000000-0000-4000-8000-0000000000c1', 'openai', 'gpt-test-1.0',
      'v1', 'limit', null,
      '{personal_data}', '{advice_phrase,format_stripped}', '{"advice_phrase": 2, "format_stripped": 1}', 1, 5, true,
      '{2,1,0}', '{search_properties,get_property}', 1200, 340, 800, 'round_cap', null, 8120
    )$$,
  'the service role writes a full row'
);
select lives_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, visitor_hash, prompt_version, outcome)
    values ('req-anonymous', now(), 'anonymous', repeat('a', 40), 'v1', 'refused')$$,
  'the service role writes an anonymous row with only the required fields'
);
select is(
  (select count(*)::int from public.ai_usage_events where request_id in ('req-signed-in', 'req-anonymous')),
  2, 'the service role reads the rows'
);
select results_eq(
  $$select rounds, retried, tool_calls_per_round, input_tokens, number_ungrounded, duration_ms
      from public.ai_usage_events where request_id = 'req-anonymous'$$,
  $$values (0, false, '{}'::integer[], 0, 0, 0)$$,
  'the counts default to zero and the lists to empty'
);
reset role;

-- No client role holds any privilege, and the table has RLS on with no policy.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_usage_events'::regclass),
  'row level security is on'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'ai_usage_events'),
  0, 'there is no policy, so no client role sees a row'
);
select ok(
  not has_table_privilege('anon', 'public.ai_usage_events', 'select')
    and not has_table_privilege('anon', 'public.ai_usage_events', 'insert')
    and not has_table_privilege('authenticated', 'public.ai_usage_events', 'select')
    and not has_table_privilege('authenticated', 'public.ai_usage_events', 'insert')
    and not has_table_privilege('authenticated', 'public.ai_usage_events', 'update')
    and not has_table_privilege('authenticated', 'public.ai_usage_events', 'delete'),
  'anon and signed-in users hold no privilege on the table'
);

set local role anon;
select throws_ok($$select * from public.ai_usage_events$$, '42501', null, 'anon cannot read usage');
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome)
    values ('req-anon-write', now(), 'anonymous', 'v1', 'answered')$$,
  '42501', null, 'anon cannot write usage'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok($$select * from public.ai_usage_events$$, '42501', null, 'a customer cannot read usage, not even their own');
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome)
    values ('req-customer-write', now(), 'anonymous', 'v1', 'answered')$$,
  '42501', null, 'a customer cannot write usage'
);
select throws_ok($$update public.ai_usage_events set outcome = 'answered'$$, '42501', null, 'a customer cannot change usage');
select throws_ok($$delete from public.ai_usage_events$$, '42501', null, 'a customer cannot delete usage');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok($$select * from public.ai_usage_events$$, '42501', null, 'not even the admin reads usage through the API');
reset role;

-- The checks: names and numbers only, never a sentence, and a caller is one kind of caller.
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome)
    values ('req-bad-outcome', now(), 'anonymous', 'v1', 'said hello')$$,
  '23514', null, 'an outcome outside the closed set is refused'
);
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome, input_tags)
    values ('req-text-tag', now(), 'anonymous', 'v1', 'answered', array['find me a flat near Guindy'])$$,
  '23514', null, 'a rule tag that is not a snake_case name (a sentence) is refused'
);
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome, tools_ran)
    values ('req-text-tool', now(), 'anonymous', 'v1', 'answered', array['call me on 9841000000'])$$,
  '23514', null, 'a tool name that is not a snake_case name is refused'
);
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome, output_counts)
    values ('req-array-counts', now(), 'anonymous', 'v1', 'answered', '["x"]')$$,
  '23514', null, 'the rule counts must be an object'
);
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, user_id, prompt_version, outcome)
    values ('req-anon-user', now(), 'anonymous', '00000000-0000-4000-8000-0000000000c1', 'v1', 'answered')$$,
  '23514', null, 'an anonymous row cannot carry a user id'
);
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, user_id, visitor_hash, prompt_version, outcome)
    values ('req-mixed', now(), 'signed_in', '00000000-0000-4000-8000-0000000000c1', repeat('b', 40), 'v1', 'answered')$$,
  '23514', null, 'a signed-in row cannot carry a visitor hash'
);
select throws_ok(
  $$insert into public.ai_usage_events (request_id, occurred_at, caller, prompt_version, outcome, input_tokens)
    values ('req-negative', now(), 'anonymous', 'v1', 'answered', -1)$$,
  '23514', null, 'a token count cannot be negative'
);

-- Deleting an account keeps its usage as an anonymous fact (the user id goes, the row stays).
delete from auth.users where id = '00000000-0000-4000-8000-0000000000c1';
select results_eq(
  $$select user_id is null, caller from public.ai_usage_events where request_id = 'req-signed-in'$$,
  $$values (true, 'signed_in'::text)$$,
  'a deleted account leaves its usage row without the user id'
);

select * from finish();
rollback;
