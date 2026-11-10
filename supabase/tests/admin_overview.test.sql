-- F04 follow-up: the numbers of the admin's Overview page (S7-T06 part 2, FR-ADM-01, ADR-121).
-- Tests: DB-FN-admin_overview, DB-PRIV-admin-overview (super admin only, runs as the caller), BR-63 (a project form
-- and its mirrored lead count once). The October 2026 fixtures are the only rows in that range, so they are counted
-- exactly; the stock and "today" are compared with the tables themselves or as a change, so a seeded database does not matter.
begin;
select plan(25);

-- ad is the reserved admin; c1 is a customer; a1 is an agent who owns the listings; b1 is a builder.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000a1', '919100000002', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'agent'),
  ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes');

insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-000000000002', 'arivu-heights', 'Arivu Heights', '00000000-0000-4000-b000-000000000001', 'Adyar', 'approved', true, now());

-- A complete listing in the given state. The system role fills it in, so the owner rules do not apply to the set-up.
create function pg_temp.new_listing(listing uuid, listing_status text) returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address
  ) values (
    listing, '00000000-0000-4000-8000-0000000000a1', listing_status, 'sale', 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road'
  ) returning id
$$;
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', 'pending');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', 'draft');

-- Visitors are told apart by a 40-character hash. 18:00 UTC on 31 Oct is 23:30 in India (still 31 Oct); 19:00 UTC is
-- 00:30 on 1 Nov in India.
insert into public.project_events (project_id, event_type, visitor_hash, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('1', 40), '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('1', 40), '2026-10-11 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'view', repeat('1', 40), '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'view', repeat('2', 40), '2026-10-12 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('3', 40), '2026-10-31 19:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('9', 40), '2026-09-01 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'shortlist', repeat('1', 40), '2026-10-10 07:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'shortlist', repeat('2', 40), '2026-10-15 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'compare', repeat('2', 40), '2026-10-10 08:00:00+00');
insert into public.saved_properties (user_id, property_id, created_at) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-9000-000000000001', '2026-10-12 09:00:00+00'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-9000-000000000002', '2026-09-02 09:00:00+00');

insert into public.project_leads (project_id, kind, name, phone, visit_date, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Arjun Menon', '9841055512', null, '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Divya Krishnan', '9884021098', null, '2026-10-10 08:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'site_visit', 'Revathi P', '9940188231', '2026-11-02', '2026-10-12 06:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'enquiry', 'Karthik Suresh', '9789044120', null, '2026-10-12 07:00:00+00'),
  ('00000000-0000-4000-c000-000000000002', 'brochure', 'Suresh N', '9787620144', null, '2026-10-31 18:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Late Enquirer', '9841000001', null, '2026-10-31 19:00:00+00'),
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Old Enquirer', '9841000002', null, '2026-09-01 06:00:00+00');
insert into public.enquiries (property_id, name, phone, created_at) values
  ('00000000-0000-4000-9000-000000000001', 'Meena S', '9841070011', '2026-10-10 06:00:00+00'),
  ('00000000-0000-4000-9000-000000000002', 'Lakshmi N', '9841070022', '2026-10-12 06:00:00+00');
-- Two forms with no project, and one on a project page (its lead is mirrored into project_leads, so it does not count).
insert into public.form_submissions (form_name, project_id, name, mobile, created_at) values
  ('Contact page', null, 'Priya', '9876543210', '2026-10-12 09:00:00+00'),
  ('Contact page', null, 'Old Sender', '9876543211', '2026-09-01 06:00:00+00'),
  ('Kadal Vista enquiry', '00000000-0000-4000-c000-000000000001', 'Arjun Menon', '9841055512', '2026-10-10 06:00:00+00');

-- "New leads today" is counted as a change: what it says before and after today's rows are added.
create temp table snap (n int);
grant all on table snap to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
insert into snap select (public.admin_overview('2026-10-01', '2026-10-31') ->> 'new_today')::int;
reset role;
create temp table writes (leads int, events int, forms int);
grant all on table writes to authenticated;
insert into writes values (
  (select count(*) from public.project_leads)::int,
  (select count(*) from public.project_events)::int,
  (select count(*) from public.form_submissions)::int
);

-- Today's rows, each a second after the other and after anything seeded, so they are the newest leads: a project
-- enquiry, a form with no project, a project form (mirrored: left out) and a property enquiry.
insert into public.project_leads (project_id, kind, name, phone, created_at) values
  ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Today Lead', '9841000010', now() + interval '1 second');
insert into public.form_submissions (form_name, project_id, name, mobile, created_at) values
  ('Contact page', null, 'Today Form', '9876543220', now() + interval '2 seconds'),
  ('Kadal Vista enquiry', '00000000-0000-4000-c000-000000000001', 'Today Mirrored', '9876543221', now() + interval '3 seconds');
insert into public.enquiries (property_id, name, phone, created_at) values
  ('00000000-0000-4000-9000-000000000001', 'Today Enquiry', '9841000011', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- The stock is as of now: listings that were submitted (not drafts), and people by role, compared with the tables.
select results_eq(
  $$select (r -> 'listings' ->> 'total')::int, (r -> 'listings' ->> 'approved')::int, (r -> 'listings' ->> 'pending')::int
    from (select public.admin_overview('2026-10-01', '2026-10-31') as r) as got$$,
  $$select (count(*) filter (where status <> 'draft'))::int, (count(*) filter (where status = 'approved'))::int,
           (count(*) filter (where status = 'pending'))::int from public.properties$$,
  'listings: those submitted, the approved and the pending (a draft is not counted)'
);
select results_eq(
  $$select (r -> 'people' ->> 'customers')::int, (r -> 'people' ->> 'agents')::int, (r -> 'people' ->> 'builders')::int
    from (select public.admin_overview('2026-10-01', '2026-10-31') as r) as got$$,
  $$select (count(*) filter (where role = 'customer'))::int, (count(*) filter (where role = 'agent'))::int,
           (count(*) filter (where role = 'builder'))::int from public.user_roles$$,
  'people: customers, agents and builders by the role they hold'
);
select is(
  public.admin_overview('2026-10-01', '2026-10-31') -> 'listings',
  public.admin_overview('2026-10-01', '2026-10-01') -> 'listings',
  'the stock does not follow the dates'
);

-- All of October: 5 project leads, 2 property enquiries and 1 form with no project (the project form is left out).
select results_eq(
  $$select (r -> 'leads' ->> 'leads')::int, (r -> 'leads' ->> 'enquiries')::int, (r -> 'leads' ->> 'shortlists')::int,
           (r -> 'leads' ->> 'visitors')::int
    from (select public.admin_overview('2026-10-01', '2026-10-31') as r) as got$$,
  $$values (8, 5, 3, 2)$$,
  'leads, enquiries (project and property), shortlists (project events and saved properties) and visitors (counted once)'
);
select is(
  public.admin_overview('2026-10-01', '2026-10-31') -> 'sources',
  '{"project_pages": 5, "property_enquiries": 2, "other_forms": 1}'::jsonb,
  'the sources add up to the leads, and a project form and its mirrored lead count once'
);
select is(
  jsonb_array_length(public.admin_overview('2026-10-01', '2026-10-31') -> 'daily'), 31,
  'one entry for each day of the range'
);
select is(
  public.admin_overview('2026-10-10', '2026-10-12') -> 'daily',
  '[{"day": "2026-10-10", "leads": 3, "enquiries": 3, "shortlists": 1},
    {"day": "2026-10-11", "leads": 0, "enquiries": 0, "shortlists": 0},
    {"day": "2026-10-12", "leads": 4, "enquiries": 2, "shortlists": 1}]'::jsonb,
  'each day has its own numbers, in order, and a quiet day is zero'
);

-- A day is a day in India: 23:30 on 31 Oct is that day, and 00:30 on 1 Nov is the next.
select is(
  (public.admin_overview('2026-10-31', '2026-10-31') -> 'leads' ->> 'leads')::int, 1,
  '23:30 on 31 Oct is still 31 Oct'
);
select is(
  (public.admin_overview('2026-11-01', '2026-11-01') -> 'leads' ->> 'leads')::int, 1,
  'and 00:30 on 1 Nov is 1 Nov'
);

select is(
  public.admin_overview('2026-10-01', '2026-10-31') -> 'top_projects',
  '[{"id": "00000000-0000-4000-c000-000000000001", "slug": "kadal-vista", "name": "Kadal Vista", "enquiries": 2},
    {"id": "00000000-0000-4000-c000-000000000002", "slug": "arivu-heights", "name": "Arivu Heights", "enquiries": 1}]'::jsonb,
  'the projects with the most enquiries, biggest first (a brochure request is not an enquiry)'
);

-- Today's rows: three of the four count (the mirrored project form does not), and they are the newest leads.
select is(
  (public.admin_overview('2026-10-01', '2026-10-31') ->> 'new_today')::int,
  (select n + 3 from snap),
  'new leads today: a project enquiry, a property enquiry and a form with no project (not the mirrored one)'
);
select is(
  jsonb_array_length(public.admin_overview('2026-10-01', '2026-10-31') -> 'recent'), 5,
  'the newest five leads'
);
select is(
  (public.admin_overview('2026-10-01', '2026-10-31') -> 'recent' -> 0) - 'id' - 'created_at',
  '{"source": "form", "kind": null, "name": "Today Form", "label": "Contact page"}'::jsonb,
  'the newest is a form with no project, named by the form (the newer mirrored project form is left out)'
);
select is(
  (public.admin_overview('2026-10-01', '2026-10-31') -> 'recent' -> 1) - 'id' - 'created_at',
  '{"source": "project", "kind": "enquiry", "name": "Today Lead", "label": "Kadal Vista"}'::jsonb,
  'then a project lead, named by its project and kind'
);
select is(
  (public.admin_overview('2026-01-01', '2026-01-02') -> 'recent' -> 0) - 'id' - 'created_at',
  (public.admin_overview('2026-10-01', '2026-10-31') -> 'recent' -> 0) - 'id' - 'created_at',
  'the newest leads do not follow the dates'
);

-- The range
select throws_ok(
  $$select public.admin_overview('2026-10-31', '2026-10-01')$$, '22023', 'overview.bad_range',
  'an end before the start is refused'
);
select throws_ok(
  $$select public.admin_overview('2025-10-01', '2026-10-31')$$, '22023', 'overview.bad_range',
  'a range of more than a year is refused'
);
select throws_ok(
  $$select public.admin_overview(null, '2026-10-31')$$, '22023', 'overview.bad_range',
  'a missing day is refused'
);

-- Anyone who is not the super admin is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select public.admin_overview('2026-10-01', '2026-10-31')$$, '42501', 'overview.not_allowed',
  'a customer cannot read it'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "phone": "919100000002"}', true);
select throws_ok(
  $$select public.admin_overview('2026-10-01', '2026-10-31')$$, '42501', 'overview.not_allowed',
  'an agent cannot read it'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.admin_overview('2026-10-01', '2026-10-31')$$, '42501', 'overview.not_allowed',
  'a builder cannot read it'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.admin_overview('2026-10-01', '2026-10-31')$$, '42501', null,
  'a visitor cannot call it (no execute grant)'
);
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name = 'admin_overview'
     and grantee in ('PUBLIC', 'anon'))::int,
  0, 'the function is not granted to the public or to visitors'
);
select is(
  (select prosecdef from pg_proc where proname = 'admin_overview' and pronamespace = 'public'::regnamespace),
  false, 'the function runs as the caller, so the row-level policies still apply'
);
select results_eq(
  $$select (select count(*) from public.project_leads)::int, (select count(*) from public.project_events)::int,
           (select count(*) from public.form_submissions)::int$$,
  $$select leads + 1, events, forms + 2 from writes$$,
  'reading the numbers changed nothing (only the three rows added for today since the snapshot)'
);

select * from finish();
rollback;
