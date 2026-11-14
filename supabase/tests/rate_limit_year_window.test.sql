-- AI chat P1-T04a (ADR-128 section 7, D9, D13): the one-year window of the free trial.
-- Tests: DB-FN-rate_limit_hit-year, DB-FN-run_retention-trial-scopes, DB-PRIV-year-window.
-- Fixture rows use a made-up subject and window starts well past each edge, so other rows in the table cannot change
-- the counts; the retention checks look only at the fixture subject.
begin;
select plan(13);

-- The cap: 366 days is accepted, one second more is refused, the one-day cases still work
select ok(
  (select allowed and retry_after = 0 from public.rate_limit_hit('ai_chat_trial_cookie', 'year-subject-one', 31622400, 2)),
  'a window of 366 days is accepted'
);
select ok(
  (select allowed from public.rate_limit_hit('ai_chat_trial_cookie', 'year-subject-one', 31622400, 2)),
  'the second message of the trial is allowed'
);
select ok(
  (select not allowed and retry_after between 1 and 31622400
     from public.rate_limit_hit('ai_chat_trial_cookie', 'year-subject-one', 31622400, 2)),
  'the third message is refused, with a retry time inside the year'
);
select is(
  (select hits from public.public_rate_limits
    where scope = 'ai_chat_trial_cookie' and subject_hash = 'year-subject-one'),
  3, 'the three attempts were counted in one row of one window'
);
select throws_ok(
  $$select * from public.rate_limit_hit('ai_chat_trial_cookie', 'year-subject-two', 31622401, 2)$$,
  'P0001', 'rate_limit.invalid_arguments', 'a window of one second over 366 days is refused'
);
select throws_ok(
  $$select * from public.rate_limit_hit('ai_chat_trial_cookie', 'year-subject-two', 0, 2)$$,
  'P0001', 'rate_limit.invalid_arguments', 'a zero-length window is still refused'
);
select throws_ok(
  $$select * from public.rate_limit_hit('ai_chat_trial_cookie', 'year-subject-two', 60, 0)$$,
  'P0001', 'rate_limit.invalid_arguments', 'an allowance of zero is still refused'
);
select ok(
  (select allowed from public.rate_limit_hit('enquiry', 'year-subject-three', 86400, 1)),
  'a window of one day still works'
);

-- Retention: the two trial scopes are kept up to 400 days, every other scope is swept after 7 days
insert into public.public_rate_limits (scope, subject_hash, window_start, hits) values
  ('ai_chat_trial_cookie', 'retention-year-aaaa', now() - interval '390 days', 2),
  ('ai_chat_trial_visitor', 'retention-year-aaaa', now() - interval '390 days', 2),
  ('ai_chat_trial_cookie', 'retention-year-aaaa', now() - interval '420 days', 2),
  ('ai_chat_trial_visitor', 'retention-year-aaaa', now() - interval '420 days', 2),
  ('ai_chat_trial_ip_ip', 'retention-year-aaaa', now() - interval '8 days', 2),
  ('ai_chat_burst_cookie', 'retention-year-aaaa', now() - interval '8 days', 2),
  ('ai_chat_trial_ip_ip', 'retention-year-aaaa', now() - interval '6 days', 2),
  ('it_retention', 'retention-year-aaaa', now() - interval '8 days', 2),
  ('it_retention', 'retention-year-aaaa', now() - interval '6 days', 2);

select lives_ok($$select public.run_retention(5000, 20)$$, 'the nightly sweep runs');

select results_eq(
  $$select scope, count(*)::int from public.public_rate_limits
    where subject_hash = 'retention-year-aaaa' and scope like 'ai_chat_trial_%' and scope <> 'ai_chat_trial_ip_ip'
    group by scope order by scope$$,
  $$values ('ai_chat_trial_cookie'::text, 1), ('ai_chat_trial_visitor'::text, 1)$$,
  'the trial rows of 390 days survive the sweep and those of 420 days are swept'
);
select results_eq(
  $$select scope, count(*)::int from public.public_rate_limits
    where subject_hash = 'retention-year-aaaa' and scope not like 'ai_chat_trial_c%' and scope not like 'ai_chat_trial_v%'
    group by scope order by scope$$,
  $$values ('ai_chat_trial_ip_ip'::text, 1), ('it_retention'::text, 1)$$,
  'the other scopes are still swept after 7 days, including the per-address cap and the burst limit'
);
select is(
  (select count(*) from public.public_rate_limits
    where subject_hash = 'retention-year-aaaa' and window_start > now() - interval '7 days')::int,
  2, 'rows inside 7 days are kept whatever the scope'
);

-- Grants are unchanged
select ok(
  has_function_privilege('service_role', 'public.rate_limit_hit(text, text, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.rate_limit_hit(text, text, integer, integer)', 'execute')
    and not has_function_privilege('anon', 'public.rate_limit_hit(text, text, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.run_retention(integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.run_retention(integer, integer)', 'execute')
    and not has_function_privilege('anon', 'public.run_retention(integer, integer)', 'execute'),
  'only the service role may run rate_limit_hit and run_retention'
);

select * from finish();
rollback;
