-- F04 follow-up: the numbers of the builder's Dashboard and Insights pages (S7-T03 step E).
-- Tests: DB-FN-builder_insights, DB-PRIV-builder-insights, BR-31 (a builder sees only their own).
begin;
select plan(15);

-- ad is the reserved admin; b1 and b2 are builders; c1 is a customer.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'hello@otherbuilders.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'hello@otherbuilders.example', 'Other Builders');

-- Kadal Homes: one live project and one waiting for approval. Other Builders: one live project.
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-000000000003', 'other-tower', 'Other Tower', '00000000-0000-4000-b000-000000000002', 'Adyar', 'approved', true, now());
insert into public.projects (id, slug, name, builder_id, locality, moderation, published) values
  ('00000000-0000-4000-c000-000000000002', 'kadal-sky', 'Kadal Sky', '00000000-0000-4000-b000-000000000001', 'Adyar', 'pending', false);

insert into public.project_units (project_id, unit_number, status) values
  ('00000000-0000-4000-c000-000000000001', 'A-1', 'available'),
  ('00000000-0000-4000-c000-000000000001', 'A-2', 'available'),
  ('00000000-0000-4000-c000-000000000001', 'A-3', 'sold'),
  ('00000000-0000-4000-c000-000000000001', 'A-4', 'hold'),
  ('00000000-0000-4000-c000-000000000002', 'B-1', 'available'),
  ('00000000-0000-4000-c000-000000000003', 'C-1', 'available'),
  ('00000000-0000-4000-c000-000000000003', 'C-2', 'sold');

-- Visitors are told apart by a 40-character hash. 18:00 UTC on 31 Oct is 23:30 in India (still 31 Oct); 19:00 UTC
-- is 00:30 on 1 Nov in India.
insert into public.project_events (project_id, event_type, visitor_hash, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('1', 40), '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('1', 40), '2026-10-11 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('2', 40), '2026-10-12 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('4', 40), '2026-10-31 18:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('3', 40), '2026-10-31 19:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('9', 40), '2026-09-01 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'shortlist', repeat('1', 40), '2026-10-10 07:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'compare', repeat('2', 40), '2026-10-10 08:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'brochure', repeat('1', 40), '2026-10-15 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'call', repeat('2', 40), '2026-10-15 07:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'whatsapp', repeat('1', 40), '2026-10-16 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'view', repeat('5', 40), '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000003', 'view', repeat('6', 40), '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000003', 'view', repeat('6', 40), '2026-10-11 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000003', 'view', repeat('6', 40), '2026-10-12 06:00:00+00');

insert into public.project_leads (project_id, kind, name, phone, visit_date, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Arjun Menon', '9841055512', null, '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Divya Krishnan', '9884021098', null, '2026-10-12 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'site_visit', 'Revathi P', '9940188231', '2026-11-02', '2026-10-14 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'brochure', 'Suresh N', '9787620144', null, '2026-10-15 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'enquiry', 'Karthik Suresh', '9789044120', null, '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000003', 'enquiry', 'Meena S', '9841070011', null, '2026-10-10 06:00:00+00');

-- Kadal Homes, all of October
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);

select results_eq(
  $$select projects::int, active_projects::int, total_units::int, available_units::int, sold_units::int,
           views::int, visitors::int, shortlists::int, comparisons::int, brochures::int, calls::int, whatsapp::int,
           enquiries::int, leads::int, site_visits::int
    from public.builder_insights('2026-10-01', '2026-10-31')$$,
  $$values (2, 1, 5, 3, 1, 5, 4, 1, 1, 1, 1, 1, 3, 5, 1)$$,
  'a builder gets the numbers of their own projects only, a visitor counted once, the other builder left out'
);
select results_eq(
  $$select projects::int, active_projects::int, total_units::int, available_units::int, sold_units::int,
           views::int, visitors::int, enquiries::int, leads::int
    from public.builder_insights('2026-10-01', '2026-10-31', '00000000-0000-4000-c000-000000000001')$$,
  $$values (1, 1, 4, 2, 1, 4, 3, 2, 4)$$,
  'one project of their own narrows every number to it'
);
select results_eq(
  $$select views::int, visitors::int, leads::int
    from public.builder_insights('2026-11-01', '2026-11-01')$$,
  $$values (1, 1, 0)$$,
  'a day is a day in India: 00:30 on 1 Nov there is that day'
);
select results_eq(
  $$select views::int, visitors::int
    from public.builder_insights('2026-10-31', '2026-10-31')$$,
  $$values (1, 1)$$,
  'and 23:30 on 31 Oct is still 31 Oct, with the first minute of 1 Nov left out'
);
select results_eq(
  $$select projects::int, total_units::int, views::int, leads::int
    from public.builder_insights('2026-10-01', '2026-10-31', '00000000-0000-4000-c000-000000000003')$$,
  $$values (0, 0, 0, 0)$$,
  'another builder''s project asked for by id counts as no project, though its units are public'
);
select throws_ok(
  $$select * from public.builder_insights('2026-10-31', '2026-10-01')$$, '22023', 'insights.bad_range',
  'an end before the start is refused'
);
select throws_ok(
  $$select * from public.builder_insights('2025-10-01', '2026-10-31')$$, '22023', 'insights.bad_range',
  'a range of more than a year is refused'
);
select throws_ok(
  $$select * from public.builder_insights(null, '2026-10-31')$$, '22023', 'insights.bad_range',
  'a missing day is refused'
);

-- The other builder sees their own project only
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}', true);
select results_eq(
  $$select projects::int, total_units::int, sold_units::int, views::int, visitors::int, leads::int
    from public.builder_insights('2026-10-01', '2026-10-31')$$,
  $$values (1, 2, 1, 3, 1, 1)$$,
  'the other builder gets their own numbers, none of Kadal Homes'
);

-- Anyone who is not an active builder is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select * from public.builder_insights('2026-10-01', '2026-10-31')$$, '42501', 'insights.not_allowed',
  'a customer cannot read it'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.builder_insights('2026-10-01', '2026-10-31')$$, '42501', 'insights.not_allowed',
  'a super admin is not a builder, so the builder''s numbers are not theirs to read'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.builder_insights('2026-10-01', '2026-10-31')$$, '42501', null,
  'a visitor cannot call it (no execute grant)'
);
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name = 'builder_insights'
     and grantee in ('PUBLIC', 'anon'))::int,
  0, 'the function is not granted to the public or to visitors'
);
select is(
  (select prosecdef from pg_proc where proname = 'builder_insights' and pronamespace = 'public'::regnamespace),
  false, 'the function runs as the caller, so the row-level policies still apply'
);
select is(
  (select count(*) from public.project_events)::int, 15, 'reading the numbers changed nothing'
);

select * from finish();
rollback;
