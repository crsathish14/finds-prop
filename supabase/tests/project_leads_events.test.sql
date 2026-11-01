-- F04 project leads and events. Tests: DB-CON-project_leads, DB-RLS-project_leads-*,
-- DB-TRG-leads-guard, DB-RLS-project_events, DB-CON-project_leads-restrict (BR-44).
begin;
select plan(25);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', 'Nila Habitats');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-000000000005', 'thendral-heights', 'Thendral Heights', '00000000-0000-4000-b000-000000000002', 'Adyar', 'approved', true, now());

insert into public.project_leads (id, project_id, kind, name, phone, visitor_hash) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-c000-000000000001', 'enquiry', 'Priya', '9876543210', repeat('a', 40)),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-c000-000000000005', 'enquiry', 'Arun', '9876500000', repeat('b', 40));
insert into public.project_events (project_id, event_type, visitor_hash) values
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('a', 40)),
  ('00000000-0000-4000-c000-000000000005', 'call', repeat('b', 40));

-- DB-CON-project_leads, DB-CON-project_leads-restrict (BR-44)
select throws_ok(
  $$delete from public.projects where id = '00000000-0000-4000-c000-000000000001'$$,
  '23503', null, 'BR-44: a project with leads cannot be deleted'
);
select throws_ok(
  $$insert into public.project_leads (project_id, kind, name, phone)
    values ('00000000-0000-4000-c000-000000000001', 'site_visit', 'Visitor', '9876543210')$$,
  '23514', null, 'a site visit needs a visit date'
);
select lives_ok(
  $$insert into public.project_leads (project_id, kind, name, phone, visit_date)
    values ('00000000-0000-4000-c000-000000000001', 'site_visit', 'Visitor', '9876543210', '2026-11-20')$$,
  'a site visit with a date is accepted'
);
select throws_ok(
  $$insert into public.project_leads (project_id, kind, name, phone)
    values ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Visitor', 'abc')$$,
  '23514', null, 'a phone number is 6 to 15 digits'
);
select throws_ok(
  $$insert into public.project_leads (project_id, kind, name, phone, visitor_hash)
    values ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Visitor', '9876543210', 'not-a-hash')$$,
  '23514', null, 'the visitor hash is 40 hex characters'
);
select throws_ok(
  $$insert into public.project_events (project_id, event_type)
    values ('00000000-0000-4000-c000-000000000001', 'purchase')$$,
  '23514', null, 'an event type comes from the closed list'
);

-- Visitors and customers
set local role anon;
select throws_ok($$select * from public.project_leads$$, '42501', null, 'anon cannot read leads');
select throws_ok($$select * from public.project_events$$, '42501', null, 'anon cannot read events');
select throws_ok(
  $$insert into public.project_leads (project_id, kind, name, phone)
    values ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Visitor', '9876543210')$$,
  '42501', null, 'anon cannot create a lead directly'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*) from public.project_leads)::int, 0, 'a customer sees no leads');
select is((select count(*) from public.project_events)::int, 0, 'a customer sees no events');

-- The builder, b1
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*) from public.project_leads)::int, 2, 'BR-31: a builder sees the leads of their own project only');
select is((select count(*) from public.project_events)::int, 1, 'BR-31: a builder sees the events of their own project only');
select lives_ok(
  $$update public.project_leads set status = 'contacted' where id = '00000000-0000-4000-e000-000000000001'$$,
  'BR-47: a builder can change a lead status'
);
select is(
  (select status from public.project_leads where id = '00000000-0000-4000-e000-000000000001'),
  'contacted',
  'the status change is stored'
);
select throws_ok(
  $$update public.project_leads set name = 'Changed' where id = '00000000-0000-4000-e000-000000000001'$$,
  '42501', null, 'BR-47: a builder cannot change other lead fields'
);
select lives_ok(
  $$update public.project_leads set status = 'closed' where id = '00000000-0000-4000-e000-000000000002'$$,
  'changing another builder''s lead is accepted but matches no rows'
);
select throws_ok(
  $$insert into public.project_leads (project_id, kind, name, phone)
    values ('00000000-0000-4000-c000-000000000001', 'enquiry', 'Visitor', '9876543210')$$,
  '42501', null, 'a builder cannot create a lead'
);
reset role;
select is(
  (select status from public.project_leads where id = '00000000-0000-4000-e000-000000000002'),
  'new',
  'the other builder''s lead is unchanged'
);

-- The other builder, b2
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}', true);
select is((select count(*) from public.project_leads)::int, 1, 'the second builder sees only their own lead');
reset role;

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select cmp_ok((select count(*) from public.project_leads)::int, '>=', 3, 'the admin sees every lead');
select cmp_ok((select count(*) from public.project_events)::int, '>=', 2, 'the admin sees every event');
reset role;

-- Defence in depth: the guard still refuses if a grant were ever widened
grant update (name, project_id) on public.project_leads to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$update public.project_leads set name = 'Changed' where id = '00000000-0000-4000-e000-000000000001'$$,
  'P0001', 'project_leads.immutable_columns', 'BR-47: the guard refuses a builder changing lead fields'
);
select throws_ok(
  $$update public.project_leads set project_id = '00000000-0000-4000-c000-000000000005'
    where id = '00000000-0000-4000-e000-000000000001'$$,
  'P0001', 'project_leads.project_immutable', 'BR-46: the guard refuses moving a lead to another project'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select lives_ok(
  $$update public.project_leads set name = 'Priya Corrected' where id = '00000000-0000-4000-e000-000000000001'$$,
  'the guard lets the admin correct a lead field'
);
reset role;

select * from finish();
rollback;
