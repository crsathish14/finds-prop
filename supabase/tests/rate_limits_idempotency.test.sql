-- F07 rate limits and idempotency keys. Tests: DB-FN-rate_limit_hit, DB-RLS-platform-denied.
begin;
select plan(22);

insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

-- DB-FN-rate_limit_hit: two attempts allowed, the third refused with a retry time
select ok(
  (select allowed and retry_after = 0 from public.rate_limit_hit('form_submit', 'visitor-hash-one', 86400, 2)),
  'the first attempt is allowed'
);
select ok(
  (select allowed from public.rate_limit_hit('form_submit', 'visitor-hash-one', 86400, 2)),
  'the second attempt is allowed'
);
select ok(
  (select not allowed and retry_after between 1 and 86400 from public.rate_limit_hit('form_submit', 'visitor-hash-one', 86400, 2)),
  'the third attempt is refused, with a retry time'
);
select ok(
  (select not allowed from public.rate_limit_hit('form_submit', 'visitor-hash-one', 86400, 2)),
  'further attempts stay refused'
);
select ok(
  (select allowed from public.rate_limit_hit('form_submit', 'visitor-hash-two', 86400, 2)),
  'another visitor has their own allowance'
);
select ok(
  (select allowed from public.rate_limit_hit('project_lead', 'visitor-hash-one', 86400, 2)),
  'another scope has its own allowance'
);

-- A counter from an earlier window does not count against the current one
insert into public.public_rate_limits (scope, subject_hash, window_start, hits)
values ('enquiry', 'visitor-hash-old', now() - interval '3 days', 99);
select ok(
  (select allowed from public.rate_limit_hit('enquiry', 'visitor-hash-old', 3600, 1)),
  'an earlier window does not count against the current one'
);

select throws_ok(
  $$select * from public.rate_limit_hit('form_submit', 'visitor-hash-one', 0, 2)$$,
  'P0001', 'rate_limit.invalid_arguments', 'a zero-length window is refused'
);
select throws_ok(
  $$select * from public.rate_limit_hit('form_submit', 'visitor-hash-one', 60, 0)$$,
  'P0001', 'rate_limit.invalid_arguments', 'an allowance of zero is refused'
);
select throws_ok(
  $$insert into public.public_rate_limits (scope, subject_hash, window_start, hits)
    values ('Bad Scope', 'visitor-hash-one', now(), 1)$$,
  '23514', null, 'a scope is lower case words'
);

-- Idempotency keys
insert into public.idempotency_keys (scope, subject, key, result)
values ('listing_create', 'user-1', '00000000-0000-4000-9999-000000000001', '{"id": "x"}');
select throws_ok(
  $$insert into public.idempotency_keys (scope, subject, key)
    values ('listing_create', 'user-1', '00000000-0000-4000-9999-000000000001')$$,
  '23505', null, 'the same key cannot be claimed twice'
);
select lives_ok(
  $$insert into public.idempotency_keys (scope, subject, key)
    values ('listing_create', 'user-2', '00000000-0000-4000-9999-000000000001')$$,
  'the same key for another subject is a different claim'
);

-- Nobody but the service role can touch either table or call the function
select ok(
  not has_function_privilege('anon', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'),
  'anon cannot call rate_limit_hit'
);
select ok(
  not has_function_privilege('authenticated', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'),
  'a signed-in user cannot call rate_limit_hit'
);
select ok(
  has_function_privilege('service_role', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'),
  'the service role can call rate_limit_hit'
);

set local role anon;
select throws_ok($$select * from public.public_rate_limits$$, '42501', null, 'anon cannot read the counters');
select throws_ok($$select * from public.idempotency_keys$$, '42501', null, 'anon cannot read the keys');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select throws_ok($$select * from public.public_rate_limits$$, '42501', null, 'a customer cannot read the counters');
select throws_ok(
  $$insert into public.public_rate_limits (scope, subject_hash, window_start, hits)
    values ('enquiry', 'visitor-hash-one', now(), 0)$$,
  '42501', null, 'a customer cannot reset a counter'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok($$select * from public.public_rate_limits$$, '42501', null, 'not even the admin reads the counters');
select throws_ok($$select * from public.idempotency_keys$$, '42501', null, 'not even the admin reads the keys');
reset role;

set local role service_role;
select cmp_ok((select count(*) from public.public_rate_limits)::int, '>=', 1, 'the service role reads the counters');
reset role;

select * from finish();
rollback;
