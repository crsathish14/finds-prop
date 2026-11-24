-- Sponsor ads report (ADR-194). Tests: DB-sponsor-events, DB-sponsor-report.
-- A view or a click is counted once per visitor, per placement, per day; who the visitor is is kept for the current
-- day only; the tables are closed to everyone; only the server counts and only the super admin reads the totals.
-- Fictional data only.
begin;
select plan(18);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

-- DB-sponsor-events: closed tables
select ok(
  not has_table_privilege('anon', 'public.sponsor_stats', 'select')
    and not has_table_privilege('authenticated', 'public.sponsor_stats', 'select')
    and not has_table_privilege('anon', 'public.sponsor_seen', 'select')
    and not has_table_privilege('authenticated', 'public.sponsor_seen', 'insert'),
  'nobody reads or writes the sponsor tables directly'
);
select ok(
  not has_function_privilege('anon', 'public.record_sponsor_event(text, text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_sponsor_event(text, text, text, text)', 'execute'),
  'only the server may count a view or a click'
);

-- Counting, once per visitor per day
select is(
  public.record_sponsor_event('hero', 'ad-lakeview', 'view', repeat('a', 40)), true,
  'a first view is counted'
);
select is(
  public.record_sponsor_event('hero', 'ad-lakeview', 'view', repeat('a', 40)), false,
  'the same visitor seeing it again that day is not'
);
select is(
  public.record_sponsor_event('hero', 'ad-lakeview', 'view', repeat('b', 40)), true,
  'another visitor is'
);
select is(
  public.record_sponsor_event('hero', 'ad-lakeview', 'click', repeat('a', 40)), true,
  'a click is counted apart from the view'
);
select is(
  public.record_sponsor_event('spotlight', '00000000-0000-4000-b000-000000000001', 'view', repeat('a', 40)), true,
  'the same visitor seeing another placement is counted'
);
select results_eq(
  $$select views, clicks from public.sponsor_stats where slot = 'hero' and sponsor_key = 'ad-lakeview'$$,
  $$values (2, 1)$$,
  'the day''s totals hold two views and one click'
);

-- Who saw what is kept for the current day only
insert into public.sponsor_seen (day, slot, sponsor_key, kind, visitor_hash)
values ((now() at time zone 'Asia/Kolkata')::date - 3, 'hero', 'ad-old', 'view', repeat('c', 40));
select public.record_sponsor_event('results', '00000000-0000-4000-b000-000000000002', 'view', repeat('c', 40));
select is(
  (select count(*)::int from public.sponsor_seen where day < (now() at time zone 'Asia/Kolkata')::date), 0,
  'the visitors of earlier days are cleared by the next count'
);

-- Refused input
select throws_ok(
  $$select public.record_sponsor_event('footer', 'x', 'view', repeat('a', 40))$$,
  '22023', 'sponsor_event.slot', 'an unknown placement is refused'
);
select throws_ok(
  $$select public.record_sponsor_event('hero', '', 'view', repeat('a', 40))$$,
  '22023', 'sponsor_event.key', 'a placement needs its sponsor'
);
select throws_ok(
  $$select public.record_sponsor_event('hero', 'x', 'hover', repeat('a', 40))$$,
  '22023', 'sponsor_event.kind', 'only views and clicks are counted'
);
select throws_ok(
  $$select public.record_sponsor_event('hero', 'x', 'view', '203.0.113.7')$$,
  '22023', 'sponsor_event.visitor', 'a visitor is a hash, never an address'
);

-- DB-sponsor-report: the super admin reads the totals
insert into public.sponsor_stats (day, slot, sponsor_key, views, clicks)
values ((now() at time zone 'Asia/Kolkata')::date - 40, 'hero', 'ad-lakeview', 50, 5);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select slot, sponsor_key, views, clicks from public.admin_sponsor_report(
      (now() at time zone 'Asia/Kolkata')::date - 6, (now() at time zone 'Asia/Kolkata')::date)
    where slot = 'hero'$$,
  $$values ('hero'::text, 'ad-lakeview'::text, 2::bigint, 1::bigint)$$,
  'the report sums the days of the period asked for'
);
select results_eq(
  $$select views, clicks from public.admin_sponsor_report(
      (now() at time zone 'Asia/Kolkata')::date - 89, (now() at time zone 'Asia/Kolkata')::date)
    where slot = 'hero'$$,
  $$values (52::bigint, 6::bigint)$$,
  'a longer period takes in the earlier days'
);
select throws_ok(
  $$select * from public.admin_sponsor_report('2026-11-10', '2026-11-01')$$,
  '22023', 'sponsor_report.range', 'a period that ends before it starts is refused'
);
select throws_ok(
  $$select * from public.admin_sponsor_report('2024-01-01', '2026-11-01')$$,
  '22023', 'sponsor_report.range', 'a period longer than a year is refused'
);
reset role;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_sponsor_report('2026-11-01', '2026-11-10')$$,
  '42501', 'sponsor_report.not_allowed', 'anyone else is refused the report'
);
reset role;

select * from finish();
rollback;
