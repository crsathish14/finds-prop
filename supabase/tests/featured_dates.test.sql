-- ADR-210: the Featured switch of a home and of a project with a first and last day. Tests: DB-FN-featured-dates,
-- DB-FN-apply_featured_dates, DB-CON-featured-dates-order, DB-PRIV-apply_featured_dates, DB-CRON-featured-dates.
begin;
select plan(24);

-- ad is the reserved admin; o1 owns the homes; b1 is a builder with projects.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes');

create function pg_temp.new_listing(listing uuid, listing_status text)
returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address
  ) values (
    listing, '00000000-0000-4000-8000-0000000000a1', listing_status, 'sale', 'apartment', 'Home in Adyar',
    'A bright flat.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu', '600020', '12 Beach Road'
  ) returning id
$$;

select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', 'pending');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, featured, images) values
  ('00000000-0000-4000-c000-000000000001', 'p-one', 'Project One', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, false, '{}'),
  ('00000000-0000-4000-c000-000000000002', 'p-two', 'Project Two', '00000000-0000-4000-b000-000000000001', 'Adyar', 'approved', true, false, '{}');

create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- DB-CON-featured-dates-order: the last day may not come before the first, set by anyone.
select throws_ok(
  $$update public.properties set featured_from = pg_temp.today(), featured_until = pg_temp.today() - 1
    where id = '00000000-0000-4000-9000-000000000001'$$,
  '23514', null, 'a home''s last featured day cannot come before its first'
);
select throws_ok(
  $$update public.projects set featured_from = pg_temp.today(), featured_until = pg_temp.today() - 1
    where id = '00000000-0000-4000-c000-000000000001'$$,
  '23514', null, 'a project''s last featured day cannot come before its first'
);

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- DB-FN-featured-dates: a feature that starts later is set but not on yet; one that runs today is on.
select is(
  (select featured from public.moderate_listing(
    '00000000-0000-4000-9000-000000000001', 'feature', null, pg_temp.today() + 3, pg_temp.today() + 10)),
  false, 'a home featured from a later day is not featured yet'
);
select is(
  (select featured from public.moderate_listing(
    '00000000-0000-4000-9000-000000000002', 'feature', null, pg_temp.today() - 1, pg_temp.today() + 1)),
  true, 'a home featured from yesterday to tomorrow is featured now'
);
select is(
  (select featured from public.moderate_project(
    '00000000-0000-4000-c000-000000000001', 'feature', null, null, pg_temp.today() - 1)),
  false, 'a project whose last featured day has passed is not featured'
);
select is(
  (select featured from public.moderate_project('00000000-0000-4000-c000-000000000002', 'feature')),
  true, 'a project featured without dates is featured at once, as before'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000002', 'feature')$$,
  '55000', 'project.not_featurable', 'featuring again with no dates changes nothing and says so'
);
select is(
  (select featured from public.moderate_project(
    '00000000-0000-4000-c000-000000000002', 'feature', null, null, pg_temp.today() + 30)),
  true, 'a featured project can be given an end date'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'feature', null,
    (now() at time zone 'Asia/Kolkata')::date + 5, (now() at time zone 'Asia/Kolkata')::date + 1)$$,
  '22023', 'listing.bad_dates', 'a home''s end date before its start date is refused'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000001', 'feature', null,
    (now() at time zone 'Asia/Kolkata')::date + 5, (now() at time zone 'Asia/Kolkata')::date + 1)$$,
  '22023', 'project.bad_dates', 'a project''s end date before its start date is refused'
);
select throws_ok(
  $$select * from public.moderate_listing('00000000-0000-4000-9000-000000000003', 'feature', null,
    (now() at time zone 'Asia/Kolkata')::date, null)$$,
  '55000', 'listing.not_featurable', 'a home waiting for review cannot be featured, dates or not'
);

-- The admin's lists carry the dates.
select is(
  (select featured_from from public.admin_listing_queue('approved')
   where id = '00000000-0000-4000-9000-000000000001'),
  pg_temp.today() + 3, 'the listing queue shows a home''s first featured day'
);
select is(
  (select featured_until from public.admin_project_overview()
   where id = '00000000-0000-4000-c000-000000000002'),
  pg_temp.today() + 30, 'the project overview shows a project''s last featured day'
);

-- Unfeature clears the dates, even of a feature that has not started.
select is(
  (select featured from public.moderate_listing('00000000-0000-4000-9000-000000000001', 'unfeature')),
  false, 'a scheduled home feature can be removed'
);
reset role;
select is(
  (select array[featured_from, featured_until] from public.properties
   where id = '00000000-0000-4000-9000-000000000001'),
  array[null, null]::date[], 'removing a feature clears its dates'
);

-- DB-FN-apply_featured_dates: the job turns a feature on when its first day arrives and off after its last.
update public.properties set featured_from = pg_temp.today(), featured_until = null, featured = false
where id = '00000000-0000-4000-9000-000000000001';
update public.properties set featured_until = pg_temp.today() - 1, featured_from = null
where id = '00000000-0000-4000-9000-000000000002';
update public.projects set featured_from = pg_temp.today() - 2, featured_until = pg_temp.today() + 2, featured = false
where id = '00000000-0000-4000-c000-000000000001';
select is(
  public.apply_featured_dates(),
  '{"homes": 2, "projects": 1}'::jsonb,
  'the job puts right two homes and one project'
);
select is(
  (select featured from public.properties where id = '00000000-0000-4000-9000-000000000001'),
  true, 'a home whose first day is today is now featured'
);
select is(
  (select featured from public.properties where id = '00000000-0000-4000-9000-000000000002'),
  false, 'a home whose last day was yesterday is no longer featured'
);
select is(
  (select featured from public.projects where id = '00000000-0000-4000-c000-000000000001'),
  true, 'a project inside its dates is featured'
);
select is(
  public.apply_featured_dates(), '{"homes": 0, "projects": 0}'::jsonb,
  'run again, the job changes nothing'
);
-- A dated home that is no longer approved is never switched on.
update public.properties set featured = false, status = 'pending'
where id = '00000000-0000-4000-9000-000000000001';
select is(
  (public.apply_featured_dates() ->> 'homes')::int, 0, 'a dated home waiting for review stays off'
);

-- DB-PRIV-apply_featured_dates and DB-CRON-featured-dates
select ok(
  not has_function_privilege('authenticated', 'public.apply_featured_dates()', 'execute')
    and not has_function_privilege('anon', 'public.apply_featured_dates()', 'execute'),
  'no visitor or signed-in person can run the job'
);
select ok(
  has_function_privilege('service_role', 'public.apply_featured_dates()', 'execute'),
  'the server can run the job'
);
select is(
  (select schedule from cron.job where jobname = 'featured-dates'),
  '*/15 * * * *', 'the job runs every 15 minutes'
);

select * from finish();
rollback;
