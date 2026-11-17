-- Place search PR 3a (ADR-134, OLA_MAPS_PLAN.md section 4.6): the daily count of calls to Ola Maps.
-- Tests: DB-RLS-places-usage-denied, DB-CHK-places-usage, DB-FN-record_places_call, DB-PRIV-places-usage-service-only,
-- DB-FN-admin_places_usage, DB-PRIV-admin-places-usage (super admin only).
-- The October 2026 and September 2026 fixtures are the only rows in their ranges, so they are counted exactly;
-- "today" and "this month" are compared as a change, so whatever else the database holds does not matter.
-- Two calls at the very same moment cannot be raced inside one test; what is checked is that a second call finds the
-- row and adds one to it (a single insert-or-increment statement), never a second row and never a lost count.
begin;
select plan(56);

-- ad is the reserved admin, c1 a customer, a1 an agent.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a1', '919100000002', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a1', 'agent');

-- The table: RLS on, no policy, and no client role holds any privilege.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.places_usage_daily'::regclass),
  'row level security is on'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'places_usage_daily'),
  0, 'there is no policy, so no client role sees a row'
);
select ok(
  not has_table_privilege('anon', 'public.places_usage_daily', 'select')
    and not has_table_privilege('anon', 'public.places_usage_daily', 'insert')
    and not has_table_privilege('authenticated', 'public.places_usage_daily', 'select')
    and not has_table_privilege('authenticated', 'public.places_usage_daily', 'insert')
    and not has_table_privilege('authenticated', 'public.places_usage_daily', 'update')
    and not has_table_privilege('authenticated', 'public.places_usage_daily', 'delete'),
  'anon and signed-in users hold no privilege on the table'
);
set local role anon;
select throws_ok($$select * from public.places_usage_daily$$, '42501', null, 'a visitor cannot read the counts');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok($$select * from public.places_usage_daily$$, '42501', null, 'a customer cannot read the counts');
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values (current_date, 'autocomplete', 'search_box', 'ok', 1000)$$,
  '42501', null, 'a customer cannot write the counts'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.places_usage_daily$$, '42501', null,
  'not even the admin reads the table through the API (the admin reads the function)'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- The checks: names and numbers only, one row for each day, API, caller and outcome.
insert into public.places_usage_daily (day, api, caller, outcome) values ('2026-01-05', 'it_constraint', 'search_box', 'ok');
select is(
  (select calls from public.places_usage_daily where api = 'it_constraint'),
  0, 'a row starts at zero calls'
);
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values ('2026-01-05', 'Autocomplete Now', 'search_box', 'ok', 1)$$,
  '23514', null, 'an api that is not a snake_case name (a sentence, capitals) is refused'
);
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values ('2026-01-05', repeat('a', 41), 'search_box', 'ok', 1)$$,
  '23514', null, 'an api name longer than 40 characters is refused'
);
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values ('2026-01-05', 'it_constraint', 'a visitor', 'ok', 1)$$,
  '23514', null, 'a caller outside the closed list is refused'
);
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values ('2026-01-05', 'it_constraint', 'search_box', 'said hello', 1)$$,
  '23514', null, 'an outcome outside the closed list is refused'
);
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values ('2026-01-06', 'it_constraint', 'search_box', 'ok', -1)$$,
  '23514', null, 'a count cannot be negative'
);
select throws_ok(
  $$insert into public.places_usage_daily (day, api, caller, outcome, calls)
    values ('2026-01-05', 'it_constraint', 'search_box', 'ok', 1)$$,
  '23505', null, 'a day, api, caller and outcome have one row only'
);

-- record_places_call: the first call makes the row (India's calendar day), a second adds one to the same row.
set local role service_role;
select lives_ok(
  $$select public.record_places_call('it_places', 'search_box', 'ok')$$,
  'the service role records a call'
);
reset role;
select results_eq(
  $$select calls, day = (now() at time zone 'Asia/Kolkata')::date from public.places_usage_daily where api = 'it_places'$$,
  $$values (1, true)$$,
  'the first call creates the row for the India day with one call'
);
set local role service_role;
select lives_ok(
  $$select public.record_places_call('it_places', 'search_box', 'ok')$$,
  'the service role records a second call'
);
select public.record_places_call('it_places', 'search_box', 'timeout');
reset role;
select results_eq(
  $$select outcome, calls from public.places_usage_daily where api = 'it_places' order by outcome$$,
  $$values ('ok'::text, 2), ('timeout'::text, 1)$$,
  'the second call adds one to the same row, and another outcome has its own row'
);

-- Bad input is refused with a stable message, and nothing is counted.
select throws_ok(
  $$select public.record_places_call('Autocomplete', 'search_box', 'ok')$$, '22023', 'places_usage.bad_api',
  'an api that is not a snake_case name is refused'
);
select throws_ok(
  $$select public.record_places_call(null, 'search_box', 'ok')$$, '22023', 'places_usage.bad_api',
  'a missing api is refused'
);
select throws_ok(
  $$select public.record_places_call(repeat('a', 41), 'search_box', 'ok')$$, '22023', 'places_usage.bad_api',
  'an api name longer than 40 characters is refused'
);
select throws_ok(
  $$select public.record_places_call('it_places', 'a visitor', 'ok')$$, '22023', 'places_usage.bad_caller',
  'a caller outside the closed list is refused'
);
select throws_ok(
  $$select public.record_places_call('it_places', null, 'ok')$$, '22023', 'places_usage.bad_caller',
  'a missing caller is refused'
);
select throws_ok(
  $$select public.record_places_call('it_places', 'search_box', 'said hello')$$, '22023', 'places_usage.bad_outcome',
  'an outcome outside the closed list is refused'
);
select throws_ok(
  $$select public.record_places_call('it_places', 'search_box', null)$$, '22023', 'places_usage.bad_outcome',
  'a missing outcome is refused'
);
select is(
  (select sum(calls)::int from public.places_usage_daily where api = 'it_places'),
  3, 'a refused call counts nothing'
);

-- Who may record: the service role only, so a browser can never inflate the counts.
select ok(
  has_function_privilege('service_role', 'public.record_places_call(text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_places_call(text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.record_places_call(text, text, text)', 'execute'),
  'only the service role may record a call'
);
set local role anon;
select throws_ok(
  $$select public.record_places_call('it_places', 'search_box', 'ok')$$, '42501', null, 'a visitor cannot record a call'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok(
  $$select public.record_places_call('it_places', 'search_box', 'ok')$$, '42501', null,
  'a signed-in person cannot record a call, not even the admin'
);
reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name = 'record_places_call'
     and grantee in ('PUBLIC', 'anon', 'authenticated'))::int,
  0, 'record_places_call is not granted to the public, to visitors or to signed-in people'
);
select is(
  (select count(*) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('record_places_call', 'admin_places_usage')
     and prosecdef and proconfig @> array['search_path=""'])::int,
  2, 'both functions run as their owner with a pinned search path'
);

-- The fixtures for the admin's numbers. 10 Oct: 10 calls; 11 Oct: none; 12 Oct: 7 calls across two APIs; 1 Sep: 100.
insert into public.places_usage_daily (day, api, caller, outcome, calls) values
  ('2026-10-10', 'autocomplete', 'search_box', 'ok', 5),
  ('2026-10-10', 'autocomplete', 'search_box', 'empty', 2),
  ('2026-10-10', 'autocomplete', 'listing_form', 'ok', 3),
  ('2026-10-12', 'autocomplete', 'ai_chat', 'timeout', 1),
  ('2026-10-12', 'autocomplete', 'admin_picker', 'quota', 2),
  ('2026-10-12', 'reverse_geocode', 'search_box', 'error', 4),
  ('2026-09-01', 'autocomplete', 'search_box', 'ok', 100);

-- "Today" and "this month" are counted as a change: what the function says before and after three calls made today.
create temp table snap (today bigint, month bigint);
grant all on table snap to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
insert into snap
select (r ->> 'today')::bigint, (r ->> 'month')::bigint
from (select public.admin_places_usage('2026-10-10', '2026-10-12') as r) as got;
reset role;
set local role service_role;
select public.record_places_call('autocomplete', 'search_box', 'ok');
select public.record_places_call('autocomplete', 'search_box', 'ok');
select public.record_places_call('autocomplete', 'ai_chat', 'empty');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- The admin's numbers for 10 to 12 October: 17 calls, 7 of which ended badly (1 timeout, 2 quota, 4 error).
select results_eq(
  $$select (r ->> 'total')::int, (r ->> 'problems')::int
    from (select public.admin_places_usage('2026-10-10', '2026-10-12') as r) as got$$,
  $$values (17, 7)$$,
  'the total of the range, and how many calls ended in a timeout, quota or error'
);
select is(
  public.admin_places_usage('2026-10-10', '2026-10-12') -> 'days',
  '[{"day": "2026-10-10", "calls": 10}, {"day": "2026-10-11", "calls": 0}, {"day": "2026-10-12", "calls": 7}]'::jsonb,
  'each day has its total, in order, and a quiet day is zero'
);
select is(
  public.admin_places_usage('2026-10-10', '2026-10-12') -> 'apis',
  '[{"api": "autocomplete", "calls": 13}, {"api": "reverse_geocode", "calls": 4}]'::jsonb,
  'the calls of each API, the busiest first'
);
select is(
  public.admin_places_usage('2026-10-10', '2026-10-12') -> 'callers',
  '{"search_box": 11, "listing_form": 3, "admin_picker": 2, "ai_chat": 1}'::jsonb,
  'the calls of each caller'
);
select is(
  public.admin_places_usage('2026-10-10', '2026-10-12') -> 'outcomes',
  '{"ok": 8, "empty": 2, "timeout": 1, "quota": 2, "error": 4}'::jsonb,
  'the calls of each outcome'
);
select is(
  (select array_agg(key order by key) from jsonb_object_keys(public.admin_places_usage('2026-10-10', '2026-10-12')) as key),
  array['apis', 'callers', 'days', 'month', 'outcomes', 'problems', 'today', 'total'],
  'the answer holds counts only: no cost, no allowance and no balance'
);
select is(
  public.admin_places_usage('2026-01-01', '2026-01-03') - 'today' - 'month' - 'days',
  '{"total": 0, "apis": [], "callers": {"search_box": 0, "listing_form": 0, "admin_picker": 0, "ai_chat": 0},
    "outcomes": {"ok": 0, "empty": 0, "timeout": 0, "quota": 0, "error": 0}, "problems": 0}'::jsonb,
  'a range with no calls says zero everywhere, with every caller and outcome present'
);
select is(
  public.admin_places_usage('2026-01-01', '2026-01-03') -> 'days',
  '[{"day": "2026-01-01", "calls": 0}, {"day": "2026-01-02", "calls": 0}, {"day": "2026-01-03", "calls": 0}]'::jsonb,
  'and every day of it is listed with a zero'
);
select is(
  (public.admin_places_usage('2026-09-01', '2026-10-12') ->> 'total')::int, 117,
  'a longer range adds the earlier days (100 on 1 September, 17 in October)'
);
select is(
  jsonb_array_length(public.admin_places_usage('2026-09-01', '2026-10-12') -> 'days'), 42,
  'and has one entry for each of its 42 days'
);
select is(
  jsonb_array_length(public.admin_places_usage('2026-07-01', '2026-09-30') -> 'days'), 92,
  'a range of 92 days, counting both ends, is allowed'
);

-- Today and this month follow the clock, not the range, and three more calls today add three to each.
select results_eq(
  $$select (r ->> 'today')::bigint, (r ->> 'month')::bigint
    from (select public.admin_places_usage('2026-10-10', '2026-10-12') as r) as got$$,
  $$select today + 3, month + 3 from snap$$,
  'three calls made today add three to today and to this month'
);
select is(
  public.admin_places_usage('2026-10-10', '2026-10-12') -> 'today',
  public.admin_places_usage('2026-01-01', '2026-01-03') -> 'today',
  'today does not follow the dates'
);
select is(
  (public.admin_places_usage('2026-10-10', '2026-10-12') ->> 'total')::int, 17,
  'and today''s calls are not in a range that ended in October'
);

-- The range
select throws_ok(
  $$select public.admin_places_usage('2026-10-12', '2026-10-10')$$, '22023', 'places_usage.bad_range',
  'an end before the start is refused'
);
select throws_ok(
  $$select public.admin_places_usage('2026-07-01', '2026-10-01')$$, '22023', 'places_usage.bad_range',
  'a range of 93 days is refused'
);
select throws_ok(
  $$select public.admin_places_usage(null, '2026-10-12')$$, '22023', 'places_usage.bad_range',
  'a missing first day is refused'
);
select throws_ok(
  $$select public.admin_places_usage('2026-10-10', null)$$, '22023', 'places_usage.bad_range',
  'a missing last day is refused'
);

-- Anyone who is not the super admin is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select public.admin_places_usage('2026-10-10', '2026-10-12')$$, '42501', 'places_usage.not_allowed',
  'a customer cannot read it'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000002"}', true);
select throws_ok(
  $$select public.admin_places_usage('2026-10-10', '2026-10-12')$$, '42501', 'places_usage.not_allowed',
  'an agent cannot read it'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.admin_places_usage('2026-10-10', '2026-10-12')$$, '42501', null,
  'a signed-out visitor cannot call it (no execute grant)'
);
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
select throws_ok(
  $$select public.admin_places_usage('2026-10-10', '2026-10-12')$$, '42501', 'places_usage.not_allowed',
  'the service role with no signed-in admin behind it is refused as well'
);
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name = 'admin_places_usage' and grantee in ('PUBLIC', 'anon'))::int,
  0, 'the function is not granted to the public or to visitors'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_places_usage(date, date)', 'execute')
    and has_function_privilege('service_role', 'public.admin_places_usage(date, date)', 'execute'),
  'it is open to signed-in people (it then refuses everyone but the admin) and to the service role'
);
select is(
  (select sum(calls)::int from public.places_usage_daily where day between '2026-09-01' and '2026-10-12'),
  117, 'reading the numbers changed nothing'
);

select * from finish();
rollback;
