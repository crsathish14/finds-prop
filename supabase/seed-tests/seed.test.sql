-- S3-T13: the fictional seed data (supabase/seed.sql). These tests need the seed, so they run on a
-- database reset WITH it (`supabase db reset`, then `supabase test db supabase/seed-tests`). The tests
-- in supabase/tests run on a database reset without it, because they assume empty tables.
-- Every number below follows from the row-number rules in seed.sql; if a rule changes, change both.
begin;
select plan(53);

-- Customers: phone-only accounts with a profile and the default role
select is(
  (select count(*) from auth.users where id::text like '5eed0000-0000-4000-8000-%')::int,
  8, 'eight seeded customers'
);
select is(
  (select count(*) from public.profiles where phone like '+9190001000%')::int,
  8, 'each has a profile with its phone in E.164 form'
);
select is(
  (select count(*) from public.user_roles
   where user_id::text like '5eed0000-0000-4000-8000-%' and role = 'customer')::int,
  8, 'each has the customer role'
);
select is(
  (select count(*) from public.user_roles where user_id::text like '5eed0000-0000-4000-8000-%')::int,
  8, 'and no other role'
);

-- Builders
select is(
  (select count(*) from public.builders where id::text like '5eed0000-0000-4000-8001-%')::int,
  6, 'six seeded builders'
);
select is(
  (select count(*) from public.builders where id::text like '5eed0000-0000-4000-8001-%' and active)::int,
  5, 'five are active, one is not'
);
select is(
  (select count(*) from public.builders where id::text like '5eed0000-0000-4000-8001-%' and kind = 'agent')::int,
  1, 'one is an agent'
);
select is(
  (select count(*) from public.builders
   where id::text like '5eed0000-0000-4000-8001-%' and (user_id is not null or email !~ '\.example$'))::int,
  0, 'none has signed in, and every email is on the reserved .example domain'
);

-- Projects
select is(
  (select count(*) from public.projects where id::text like '5eed0000-0000-4000-8002-%')::int,
  12, 'twelve seeded projects'
);
select is(
  (select count(*) from public.projects where moderation = 'approved' and published)::int,
  9, 'nine are live'
);
select is(
  (select count(*) from public.projects where moderation = 'approved' and published and featured)::int,
  2, 'two live projects are featured'
);
select is(
  (select count(*) from public.projects where moderation = 'approved' and not published)::int,
  1, 'one is approved but not published'
);
select is(
  (select count(*) from public.projects where moderation = 'pending')::int,
  1, 'one is waiting for review'
);
select is(
  (select count(*) from public.projects where moderation = 'rejected' and rejection_reason is not null)::int,
  1, 'one is rejected, with its reason'
);

-- Units and price trends
select is((select count(*) from public.project_units)::int, 95, 'ninety-five units in all');
select is(
  (select min(unit_count) from (select count(*) as unit_count from public.project_units group by project_id) as per_project)::int,
  6, 'every project has at least six units'
);
select is(
  (select max(unit_count) from (select count(*) as unit_count from public.project_units group by project_id) as per_project)::int,
  10, 'and at most ten'
);
select is(
  (select count(distinct status) from public.project_units)::int,
  3, 'available, hold and sold units all exist'
);
select is((select count(*) from public.project_price_trends)::int, 144, 'twelve months of trends for twelve projects');
select is(
  (select count(*) from (
     select project_id from public.project_price_trends
     group by project_id
     having count(distinct month) = 12 and max(month) = date_trunc('month', current_date)::date
   ) as complete)::int,
  12, 'each project has twelve distinct months, ending this month'
);

-- Listings
select is((select count(*) from public.properties)::int, 60, 'sixty listings');
select is((select count(*) from public.properties where status = 'approved')::int, 42, 'forty-two approved');
select is((select count(*) from public.properties where status = 'pending')::int, 6, 'six pending');
select is(
  (select count(*) from public.properties where status = 'rejected' and rejection_reason is not null)::int,
  3, 'three rejected, each with a reason'
);
select is((select count(*) from public.properties where status = 'sold')::int, 4, 'four sold');
select is((select count(*) from public.properties where status = 'rented')::int, 2, 'two rented');
select is((select count(*) from public.properties where status = 'draft')::int, 3, 'three drafts');
select is((select count(*) from public.properties where featured)::int, 3, 'three featured, all of them approved');
select is((select count(*) from public.properties where listing_type = 'rent')::int, 20, 'twenty rentals, forty sales');
select is((select count(distinct property_type) from public.properties)::int, 5, 'all five property types appear');
select is((select count(distinct city) from public.properties)::int, 10, 'ten cities');
select is((select count(distinct owner_id) from public.properties)::int, 8, 'every customer owns listings');
select is(
  (select count(distinct short_id) from public.properties where short_id like 'seed%')::int,
  60, 'every listing has its own seed short id'
);
select is(
  (select count(*) from public.properties
   where status = 'approved'
     and not (extensions.st_y(location::extensions.geometry) between 8 and 13.6
          and extensions.st_x(location::extensions.geometry) between 76.2 and 80.4))::int,
  0, 'every approved listing is inside Tamil Nadu'
);

-- Content
select is(
  (select count(*) from public.forms
   where slug = 'kadal-heights-visit' and active and kind = 'site_visit' and placement = 'project_specific'
     and project_id = '5eed0000-0000-4000-8002-000000000001' and jsonb_array_length(fields) = 4)::int,
  1, 'one active site-visit form with four fields, made for the first project'
);
select is(
  (select array_agg(slug order by slug) from public.forms where placement = 'contact'),
  array['contact']::text[],
  'the default contact form comes from the migration and the seed adds no second one'
);
select is(
  (select public_form.slug from public.public_project_form('kadal-heights-adyar') as public_form),
  'kadal-heights-visit',
  'the first project shows its own form'
);
select is(
  (select count(*) from public.public_project_form('kadal-greens-navalur'))::int,
  0, 'the other projects show no form of their own, so the page uses its built-in card'
);
select is(
  (select array_agg(key order by key) from public.site_settings),
  array['homepage', 'region']::text[],
  'the homepage and region settings are seeded, the rest use the defaults in code'
);
select is(
  (select jsonb_array_length(value -> 'localities') from public.site_settings where key = 'homepage'),
  8, 'eight homepage localities'
);

-- What a visitor sees (RLS on the seeded rows)
set local role anon;
select is((select count(*) from public.properties)::int, 42, 'a visitor sees the 42 approved listings');
select is((select count(*) from public.projects)::int, 9, 'a visitor sees the 9 live projects');
reset role;

-- Taking the seed out again (supabase/seed-remove.sql): the same statements, run against the seed and the
-- rows a tester leaves behind on it. Last in this file, because it deletes what the checks above read.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000d1', 'tester@example.test', now());
insert into public.enquiries (property_id, user_id, name, phone)
select id, '00000000-0000-4000-8000-0000000000d1', 'Test Sender', '9000000000'
from public.properties where short_id like 'seed%' order by short_id limit 1;
insert into public.saved_properties (user_id, property_id)
select '00000000-0000-4000-8000-0000000000d1', id
from public.properties where short_id like 'seed%' order by short_id limit 1;
insert into public.project_leads (project_id, kind, name, phone)
values ('5eed0000-0000-4000-8002-000000000001', 'enquiry', 'Test Sender', '9000000000');
insert into public.form_submissions (form_id, form_name, project_id, name, mobile, crm_status)
values ('5eed0000-0000-4000-8003-000000000001', 'Kadal Heights site visit',
        '5eed0000-0000-4000-8002-000000000001', 'Test Sender', '9000000000', 'not_applicable');

select lives_ok(
  $remove$
delete from public.project_leads where project_id::text like '5eed0000-0000-4000-8002-%';
delete from public.form_submissions
  where form_id::text like '5eed0000-0000-4000-8003-%' or project_id::text like '5eed0000-0000-4000-8002-%';
delete from public.forms where id::text like '5eed0000-0000-4000-8003-%';
delete from public.projects where id::text like '5eed0000-0000-4000-8002-%';
delete from public.builders where id::text like '5eed0000-0000-4000-8001-%';
delete from public.properties where owner_id::text like '5eed0000-0000-4000-8000-%';
delete from auth.users where id::text like '5eed0000-0000-4000-8000-%';
delete from public.site_settings where key in ('homepage', 'region');
  $remove$,
  'the removal runs, although a tester has left an enquiry, a saved home, a lead and a form submission'
);
select is((select count(*) from auth.users where id::text like '5eed0000-%')::int, 0, 'no seeded customer is left');
select is((select count(*) from public.properties where short_id like 'seed%')::int, 0, 'no seeded listing is left');
select is((select count(*) from public.builders where id::text like '5eed0000-%')::int, 0, 'no seeded builder is left');
select is((select count(*) from public.projects where id::text like '5eed0000-%')::int, 0, 'no seeded project is left');
select is(
  (select count(*) from public.project_units where project_id::text like '5eed0000-%')::int
    + (select count(*) from public.project_price_trends where project_id::text like '5eed0000-%')::int,
  0, 'and no unit or price trend of theirs'
);
select is(
  (select count(*) from public.project_leads)::int + (select count(*) from public.enquiries)::int
    + (select count(*) from public.saved_properties)::int + (select count(*) from public.form_submissions)::int,
  0, 'the tester''s enquiry, saved home, lead and submission went with the listings and projects'
);
select is((select count(*) from public.forms where id::text like '5eed0000-%')::int, 0, 'the project form is gone');
select is(
  (select array_agg(slug order by slug) from public.forms),
  array['contact']::text[],
  'the default contact form stays'
);
select is((select count(*) from public.site_settings)::int, 0, 'the two seeded settings are gone');
select is(
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-0000000000d1')::int,
  1, 'an account that is not the seed''s stays'
);

select * from finish();
rollback;
