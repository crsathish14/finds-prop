-- F04 follow-up: save a project's price trends in one step (S7-T02). Tests: DB-FN-save_project_price_trends, DB-PRIV-admin-trends.
begin;
select plan(14);

-- ad is the reserved admin; b1 is a builder with a project; c1 is a customer.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes');
insert into public.projects (id, slug, name, builder_id, locality) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur'),
  ('00000000-0000-4000-c000-000000000002', 'kadal-sky', 'Kadal Sky', '00000000-0000-4000-b000-000000000001', 'Adyar');
-- Kadal Sky has a month of its own, which another project's save must never touch.
insert into public.project_price_trends (project_id, month, price_per_sqft) values
  ('00000000-0000-4000-c000-000000000002', '2026-09-01', 9100);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

select is(
  public.save_project_price_trends('00000000-0000-4000-c000-000000000001',
    '[{"month": "2026-08-01", "price_per_sqft": 8100}, {"month": "2026-09-01", "price_per_sqft": 8230}, {"month": "2026-10-01", "price_per_sqft": 8350}]'::jsonb),
  3, 'the admin saves a list of months and gets the number now stored'
);
select results_eq(
  $$select to_char(month, 'YYYY-MM'), price_per_sqft from public.project_price_trends
    where project_id = '00000000-0000-4000-c000-000000000001' order by month$$,
  $$values ('2026-08', 8100), ('2026-09', 8230), ('2026-10', 8350)$$,
  'the months are stored with their prices'
);
select is(
  public.save_project_price_trends('00000000-0000-4000-c000-000000000001',
    '[{"month": "2026-09-01", "price_per_sqft": 8300}, {"month": "2026-11-01", "price_per_sqft": 8400}]'::jsonb),
  2, 'a second save follows the new list'
);
select results_eq(
  $$select to_char(month, 'YYYY-MM'), price_per_sqft from public.project_price_trends
    where project_id = '00000000-0000-4000-c000-000000000001' order by month$$,
  $$values ('2026-09', 8300), ('2026-11', 8400)$$,
  'months left out are removed, a kept month is changed and a new month is added'
);
select is(
  (select price_per_sqft from public.project_price_trends
    where project_id = '00000000-0000-4000-c000-000000000002'),
  9100, 'another project''s months are never touched'
);
select is(
  public.save_project_price_trends('00000000-0000-4000-c000-000000000001', '[]'::jsonb),
  0, 'an empty list clears the project''s months'
);

-- What the table or the function refuse leaves the list as it was.
select public.save_project_price_trends('00000000-0000-4000-c000-000000000001',
  '[{"month": "2026-10-01", "price_per_sqft": 8350}]'::jsonb);
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000001',
    '[{"month": "2026-10-15", "price_per_sqft": 8350}]'::jsonb)$$,
  '23514', null, 'a month that is not the first of a month is refused by the table'
);
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000001',
    '[{"month": "2026-10-01", "price_per_sqft": 0}]'::jsonb)$$,
  '23514', null, 'a price of nothing is refused by the table'
);
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000001',
    '[{"month": "2026-10-01", "price_per_sqft": 8000}, {"month": "2026-10-01", "price_per_sqft": 8100}]'::jsonb)$$,
  '23505', 'project_price_trends.duplicate_month', 'the same month twice is refused'
);
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000001', '{"month": "2026-10-01"}'::jsonb)$$,
  '22023', 'project_price_trends.invalid_rows', 'a list that is not a list is refused'
);
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000009',
    '[{"month": "2026-10-01", "price_per_sqft": 8350}]'::jsonb)$$,
  '23503', 'project_price_trends.no_project', 'a project that is not there is refused'
);
select is(
  (select count(*)::int from public.project_price_trends where project_id = '00000000-0000-4000-c000-000000000001'),
  1, 'after all the refusals the list is as it was'
);

-- Anyone else is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000001', '[]'::jsonb)$$,
  '42501', 'project_price_trends.not_allowed', 'a builder, even of this project, cannot save price trends'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.save_project_price_trends('00000000-0000-4000-c000-000000000001', '[]'::jsonb)$$,
  '42501', null, 'a visitor who is not signed in cannot call it'
);
reset role;

select * from finish();
rollback;
