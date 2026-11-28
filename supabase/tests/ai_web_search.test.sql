-- AI chat web search (ADR-218). Tests: DB-RLS-ai-web-answers-denied, DB-CHK-ai-web-answers, DB-RLS-ai-assistant-settings,
-- DB-SCH-no-web-search-switch, DB-FN-admin_ai_assistant_overview, DB-CHK-ai-usage-web-searches. Fictional data only.
begin;
select plan(19);

-- ad is the reserved admin, c1 a customer.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());

-- DB-RLS-ai-web-answers-denied: the memory is the server's only.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_web_answers'::regclass),
  'row level security is on for the web answers'
);
select ok(
  not has_table_privilege('anon', 'public.ai_web_answers', 'select')
    and not has_table_privilege('authenticated', 'public.ai_web_answers', 'select')
    and not has_table_privilege('authenticated', 'public.ai_web_answers', 'insert')
    and not has_table_privilege('authenticated', 'public.ai_web_answers', 'update'),
  'no client role reads or writes the web answers'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, expires_at)
    values ('stamp duty', 'stamp duty', 'A made-up answer', now() + interval '7 days')$$,
  '42501', null, 'a customer cannot plant an answer for other visitors'
);
select throws_ok($$select query from public.ai_web_answers$$, '42501', null, 'a customer cannot read the memory');
reset role;
select set_config('request.jwt.claims', '', true);

-- DB-CHK-ai-web-answers
select lives_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, sources, expires_at)
    values ('tn stamp duty rate', 'TN stamp duty rate', 'A made-up answer of the search.',
      '[{"title": "Made-up page", "url": "https://example.test/stamp"}]', now() + interval '7 days')$$,
  'the server keeps the search words, the answer and its sources'
);
select throws_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, expires_at)
    values ('TN Stamp', 'TN stamp', 'x', now() + interval '7 days')$$,
  '23514', null, 'the key is lower case'
);
select throws_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, expires_at)
    values ('two  spaces', 'two spaces', 'x', now() + interval '7 days')$$,
  '23514', null, 'the key has single spaces'
);
select throws_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, expires_at)
    values ('tn stamp duty rate', 'again', 'x', now() + interval '7 days')$$,
  '23505', null, 'one row per search words'
);
select throws_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, expires_at)
    values ('old answer', 'old answer', 'x', now() - interval '1 day')$$,
  '23514', null, 'an answer expires after it was searched'
);
select throws_ok(
  $$insert into public.ai_web_answers (query_key, query, answer, sources, expires_at)
    values ('many sources', 'many sources', 'x', '[1,2,3,4,5,6]', now() + interval '7 days')$$,
  '23514', null, 'at most five sources'
);

-- DB-CHK-ai-usage-web-searches
select col_default_is('public', 'ai_usage_events', 'web_searches', '0', 'a message made no web search unless it says so');

-- DB-SCH-no-web-search-switch and DB-RLS-ai-assistant-settings. The switch is the server setting FLAG_AI_WEB_SEARCH
-- since 28 Nov 2026 (ADR-218), so the database holds none.
select hasnt_function('public', 'ai_web_search_on', 'the database has no web search switch any more');
select hasnt_column('public', 'ai_assistant_settings', 'web_search', 'the settings row has no web search switch');
set local role anon;
select throws_ok($$select credit_bought_usd from public.ai_assistant_settings$$, '42501', null, 'a visitor cannot read the settings');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*)::int from public.ai_assistant_settings), 0, 'a customer sees no settings row');
update public.ai_assistant_settings set credit_bought_usd = 99;
select throws_ok(
  $$select public.admin_ai_assistant_overview()$$, '42501', null, 'a customer cannot read the overview'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select is(
  (select credit_bought_usd from public.ai_assistant_settings where id = 1), null::numeric,
  'a customer cannot change the credit bought'
);
update public.ai_assistant_settings set credit_bought_usd = 20;

-- DB-FN-admin_ai_assistant_overview
select is(
  public.admin_ai_assistant_overview() -> 'settings',
  '{"creditBoughtUsd": 20.00}'::jsonb,
  'the overview gives the credit bought'
);
select is(
  public.admin_ai_assistant_overview() -> 'answers' -> 0 ->> 'query',
  'TN stamp duty rate',
  'the overview lists the search words used most, never a visitor message'
);
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
