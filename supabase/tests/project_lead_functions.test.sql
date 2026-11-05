-- F12 public slice: submit_project_lead(), track_project_event() and public_project_id().
-- Tests: DB-FN-submit_project_lead, DB-FN-track_project_event (BR-71, BR-72, BR-75, BR-94).
begin;
select plan(41);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', 'Nila Habitats');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-000000000002', 'kadal-draft', 'Kadal Draft', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', false, now()),
  ('00000000-0000-4000-c000-000000000003', 'kadal-pending', 'Kadal Pending', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'pending', false, null),
  ('00000000-0000-4000-c000-000000000004', 'nila-heights', 'Nila Heights', '00000000-0000-4000-b000-000000000002', 'Adyar', 'approved', true, now());
-- The second builder is deactivated: its approved, published project is no longer visible (BR-94).
update public.builders set active = false where id = '00000000-0000-4000-b000-000000000002';

-- Only the server (service_role) may call the three functions
select ok(
  not has_function_privilege('anon', 'public.submit_project_lead(text,text,text,text,text,text,text,date)', 'execute'),
  'anon cannot call submit_project_lead'
);
select ok(
  not has_function_privilege('authenticated', 'public.submit_project_lead(text,text,text,text,text,text,text,date)', 'execute'),
  'a signed-in user cannot call submit_project_lead directly'
);
select ok(
  has_function_privilege('service_role', 'public.submit_project_lead(text,text,text,text,text,text,text,date)', 'execute'),
  'the server can call submit_project_lead'
);
select ok(
  not has_function_privilege('anon', 'public.track_project_event(text,text,text)', 'execute'),
  'anon cannot call track_project_event'
);
select ok(
  not has_function_privilege('authenticated', 'public.track_project_event(text,text,text)', 'execute'),
  'a signed-in user cannot call track_project_event directly'
);
select ok(
  has_function_privilege('service_role', 'public.track_project_event(text,text,text)', 'execute'),
  'the server can call track_project_event'
);
select ok(
  not has_function_privilege('anon', 'public.public_project_id(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.public_project_id(text)', 'execute'),
  'the project lookup is for the server only'
);

-- public_project_id: what a visitor can see
select is(public.public_project_id('kadal-vista'), '00000000-0000-4000-c000-000000000001'::uuid, 'an approved, published project of an active builder is found');
select is(public.public_project_id('kadal-draft'), null, 'an unpublished project is not found');
select is(public.public_project_id('kadal-pending'), null, 'a project waiting for review is not found');
select is(public.public_project_id('nila-heights'), null, 'a project of an inactive builder is not found (BR-94)');
select is(public.public_project_id('no-such-project'), null, 'an unknown slug is not found');

-- DB-FN-submit_project_lead
select ok(
  public.submit_project_lead('kadal-vista', 'enquiry', '  Priya Raman ', '919840012345', repeat('a', 40), 'priya@example.test', 'Is a 3 BHK left?', null) is not null,
  'an enquiry is stored and its id returned'
);
select results_eq(
  $$select name, kind, phone, email, message, visit_date::text, visitor_hash, project_id::text
    from public.project_leads where visitor_hash = repeat('a', 40)$$,
  $$values ('Priya Raman'::text, 'enquiry'::text, '919840012345'::text, 'priya@example.test'::text,
            'Is a 3 BHK left?'::text, null::text, repeat('a', 40), '00000000-0000-4000-c000-000000000001'::text)$$,
  'the lead keeps the trimmed name, the phone, the visitor hash and the project, with no date'
);
select lives_ok(
  $$select public.submit_project_lead('kadal-vista', 'site_visit', 'Arun Kumar', '919840012346', repeat('b', 40), null, null, ((now() at time zone 'Asia/Kolkata')::date + 3))$$,
  'a site visit with a date in the next days is stored'
);
select is(
  (select visit_date from public.project_leads where visitor_hash = repeat('b', 40)),
  ((now() at time zone 'Asia/Kolkata')::date + 3),
  'the visit date is kept'
);
select lives_ok(
  $$select public.submit_project_lead('kadal-vista', 'site_visit', 'Today Visitor', '919840012347', repeat('1', 40), null, null, (now() at time zone 'Asia/Kolkata')::date)$$,
  'a site visit for today is accepted'
);
select lives_ok(
  $$select public.submit_project_lead('kadal-vista', 'site_visit', 'Far Visitor', '919840012348', repeat('2', 40), null, null, ((now() at time zone 'Asia/Kolkata')::date + 365))$$,
  'a site visit a year ahead is accepted'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-vista', 'site_visit', 'No Date', '919840012349', repeat('c', 40), null, null, null)$$,
  '22023', 'project_lead.visit_date', 'a site visit needs a date'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-vista', 'site_visit', 'Past Date', '919840012349', repeat('c', 40), null, null, ((now() at time zone 'Asia/Kolkata')::date - 1))$$,
  '22023', 'project_lead.visit_date', 'a site visit cannot be in the past'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-vista', 'site_visit', 'Far Date', '919840012349', repeat('c', 40), null, null, ((now() at time zone 'Asia/Kolkata')::date + 366))$$,
  '22023', 'project_lead.visit_date', 'a site visit cannot be more than a year ahead'
);
select lives_ok(
  $$select public.submit_project_lead('kadal-vista', 'enquiry', 'Dated Enquiry', '919840012350', repeat('d', 40), null, null, ((now() at time zone 'Asia/Kolkata')::date + 5))$$,
  'an enquiry is stored even if a date came with it'
);
select is(
  (select visit_date from public.project_leads where visitor_hash = repeat('d', 40)),
  null,
  'an enquiry keeps no date'
);
select lives_ok(
  $$select public.submit_project_lead('kadal-vista', 'enquiry', 'Empty Extras', '919840012351', repeat('e', 40), '   ', '', null)$$,
  'an empty email and message are accepted'
);
select results_eq(
  $$select email, message from public.project_leads where visitor_hash = repeat('e', 40)$$,
  $$values (null::text, null::text)$$,
  'an empty email and message are stored as nothing'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-vista', 'brochure', 'Brochure Fan', '919840012352', repeat('f', 40), null, null, null)$$,
  '22023', 'project_lead.kind', 'only an enquiry or a site visit is a lead from this function'
);
select throws_ok(
  $$select public.submit_project_lead('no-such-project', 'enquiry', 'Nobody', '919840012353', repeat('f', 40), null, null, null)$$,
  'P0002', 'project_lead.project_not_found', 'an unknown project takes no lead'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-draft', 'enquiry', 'Draft Fan', '919840012354', repeat('f', 40), null, null, null)$$,
  'P0002', 'project_lead.project_not_found', 'an unpublished project takes no lead'
);
select throws_ok(
  $$select public.submit_project_lead('nila-heights', 'enquiry', 'Nila Fan', '919840012355', repeat('f', 40), null, null, null)$$,
  'P0002', 'project_lead.project_not_found', 'a project of an inactive builder takes no lead'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-vista', 'enquiry', 'No Hash', '919840012356', 'not-a-hash', null, null, null)$$,
  '22023', 'project_lead.visitor', 'a lead needs a visitor hash, never an address'
);
select throws_ok(
  $$select public.submit_project_lead('kadal-vista', 'enquiry', 'P', '919840012357', repeat('f', 40), null, null, null)$$,
  '23514', null, 'the table still refuses a name of one letter'
);

-- DB-FN-track_project_event (BR-71)
select is(public.track_project_event('kadal-vista', 'view', repeat('a', 40)), true, 'a first view is recorded');
select is(public.track_project_event('kadal-vista', 'view', repeat('a', 40)), false, 'the same visitor and project within the hour record no second view');
select is(
  (select count(*)::int from public.project_events where event_type = 'view' and visitor_hash = repeat('a', 40)),
  1,
  'one view is stored for that visitor'
);
select is(public.track_project_event('kadal-vista', 'view', repeat('b', 40)), true, 'another visitor records their own view');
insert into public.project_events (project_id, event_type, visitor_hash, created_at)
  values ('00000000-0000-4000-c000-000000000001', 'view', repeat('c', 40), now() - interval '2 hours');
select is(public.track_project_event('kadal-vista', 'view', repeat('c', 40)), true, 'a view is recorded again once the hour has passed');
select is(public.track_project_event('kadal-vista', 'call', repeat('a', 40)), true, 'another kind of event is recorded');
select is(public.track_project_event('kadal-vista', 'call', repeat('a', 40)), true, 'only views are de-duplicated');
select is(public.track_project_event('kadal-draft', 'view', repeat('a', 40)), false, 'a project nobody can see records nothing and raises no error');
select throws_ok(
  $$select public.track_project_event('kadal-vista', 'purchase', repeat('a', 40))$$,
  '22023', 'project_event.type', 'an unknown kind of event is refused'
);
select throws_ok(
  $$select public.track_project_event('kadal-vista', 'view', 'not-a-hash')$$,
  '22023', 'project_event.visitor', 'an event needs a visitor hash, never an address'
);

select * from finish();
rollback;
