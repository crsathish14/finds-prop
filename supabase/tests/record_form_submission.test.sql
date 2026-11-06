-- F05 forms (S5-T05): record_form_submission(). Tests: DB-FN-record_form_submission (BR-60 to BR-63, BR-75, BR-94).
begin;
select plan(25);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000f1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000f2', 'builder2@example.test', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'builder'),
  ('00000000-0000-4000-8000-0000000000f2', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-0000000000f1', '00000000-0000-4000-8000-0000000000f1', 'builder1@example.test', 'Kadal Homes'),
  ('00000000-0000-4000-b000-0000000000f2', '00000000-0000-4000-8000-0000000000f2', 'builder2@example.test', 'Nila Habitats');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-0000000000f1', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-0000000000f1', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-0000000000f2', 'nila-heights', 'Nila Heights', '00000000-0000-4000-b000-0000000000f2', 'Adyar', 'approved', true, now());
-- The second builder is deactivated: its approved, published project is not visible (BR-94).
update public.builders set active = false where id = '00000000-0000-4000-b000-0000000000f2';

insert into public.forms (id, name, slug, kind, placement, project_id, fields, active) values
  ('00000000-0000-4000-d000-0000000000f1', 'Contact', 'contact-form', 'contact', 'contact', null, '[]', true),
  ('00000000-0000-4000-d000-0000000000f2', 'Project enquiry', 'project-enquiry', 'enquiry', 'project', null, '[]', true),
  ('00000000-0000-4000-d000-0000000000f3', 'Vista site visit', 'vista-visit', 'site_visit', 'project_specific', '00000000-0000-4000-c000-0000000000f1', '[]', true),
  ('00000000-0000-4000-d000-0000000000f4', 'Old form', 'old-form', 'contact', 'contact', null, '[]', false),
  ('00000000-0000-4000-d000-0000000000f5', 'Hidden form', 'hidden-form', 'contact', 'none', null, '[]', true),
  ('00000000-0000-4000-d000-0000000000f6', 'Nila form', 'nila-form', 'enquiry', 'project_specific', '00000000-0000-4000-c000-0000000000f2', '[]', true);

-- Only the server (service_role) may call it
select ok(
  not has_function_privilege('anon', 'public.record_form_submission(text,text,text,text,text,jsonb,jsonb,text,text,uuid)', 'execute'),
  'anon cannot call record_form_submission'
);
select ok(
  not has_function_privilege('authenticated', 'public.record_form_submission(text,text,text,text,text,jsonb,jsonb,text,text,uuid)', 'execute'),
  'a signed-in user cannot call record_form_submission directly'
);
select ok(
  has_function_privilege('service_role', 'public.record_form_submission(text,text,text,text,text,jsonb,jsonb,text,text,uuid)', 'execute'),
  'the server can call record_form_submission'
);

-- A contact submission
select ok(
  public.record_form_submission('contact-form', repeat('a', 40), '  Priya Raman ', '919840012345', 'priya@example.test',
    '{"interest":"A home to buy","message":"Hello"}', '[]', '/contact', null, '00000000-0000-4000-8000-0000000000a1') is not null,
  'a contact submission is stored and its id returned'
);
select results_eq(
  $$select form_id::text, form_name, name, mobile, email, data::text, source, crm_status, visitor_hash,
           project_id is null, project_lead_id is null
    from public.form_submissions where idempotency_key = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values ('00000000-0000-4000-d000-0000000000f1'::text, 'Contact'::text, 'Priya Raman'::text, '919840012345'::text,
            'priya@example.test'::text, '{"message": "Hello", "interest": "A home to buy"}'::text, '/contact'::text,
            'not_applicable'::text, repeat('a', 40), true, true)$$,
  'the submission keeps the form, the trimmed name, the contact columns, the data, the source and the visitor hash, with no project'
);

-- The same key again stores nothing more and returns the first submission
select is(
  public.record_form_submission('contact-form', repeat('a', 40), 'Priya Raman', '919840012345', null, '{}', '[]', '/contact', null,
    '00000000-0000-4000-8000-0000000000a1'),
  (select id from public.form_submissions where idempotency_key = '00000000-0000-4000-8000-0000000000a1'),
  'a repeat with the same key returns the first submission'
);
select is(
  (select count(*)::int from public.form_submissions where idempotency_key = '00000000-0000-4000-8000-0000000000a1'),
  1,
  'a repeat with the same key stores nothing more'
);

-- Empty contact columns are null
select lives_ok(
  $$select public.record_form_submission('contact-form', repeat('b', 40), '', '', '  ', '{"message":"Only a message"}', '[]', null, null, null)$$,
  'a submission with no name, phone or email is stored'
);
select results_eq(
  $$select name, mobile, email from public.form_submissions where visitor_hash = repeat('b', 40)$$,
  $$values (null::text, null::text, null::text)$$,
  'empty name, phone and email become null'
);

-- A form for every project page: the project is the page it was filled in on, and the lead is mirrored (BR-63)
select lives_ok(
  $$select public.record_form_submission('project-enquiry', repeat('c', 40), 'Arun Kumar', '919840012346', 'arun@example.test',
      '{"message":"Is a 3 BHK left?"}', '[]', '/projects/kadal-vista', 'kadal-vista', null)$$,
  'a project page form is stored with the project it was filled in on'
);
select results_eq(
  $$select s.project_id::text, l.kind, l.name, l.phone, l.email, l.message, l.visitor_hash, s.project_lead_id = l.id
    from public.form_submissions s join public.project_leads l on l.id = s.project_lead_id
    where s.visitor_hash = repeat('c', 40)$$,
  $$values ('00000000-0000-4000-c000-0000000000f1'::text, 'enquiry'::text, 'Arun Kumar'::text, '919840012346'::text,
            'arun@example.test'::text, 'Is a 3 BHK left?'::text, repeat('c', 40), true)$$,
  'the submission is mirrored into project_leads with the name, phone, email, message and visitor'
);
select lives_ok(
  $$select public.record_form_submission('project-enquiry', repeat('d', 40), 'Arun Kumar', '919840012346', null, '{}', '[]', null, null, null)$$,
  'a project page form with no project page named is stored'
);
select results_eq(
  $$select project_id is null, project_lead_id is null from public.form_submissions where visitor_hash = repeat('d', 40)$$,
  $$values (true, true)$$,
  'it has no project and no lead'
);

-- A site visit form for one project needs a valid visit date to be mirrored
select lives_ok(
  $$select public.record_form_submission('vista-visit', repeat('e', 40), 'Divya Krishnan', '919840012347', null,
      format('{"visit_date":"%s"}', ((now() at time zone 'Asia/Kolkata')::date + 2))::jsonb, '[]', null, null, null)$$,
  'a site visit with a visit date is stored'
);
select is(
  (select l.visit_date from public.form_submissions s join public.project_leads l on l.id = s.project_lead_id
   where s.visitor_hash = repeat('e', 40)),
  ((now() at time zone 'Asia/Kolkata')::date + 2),
  'the visit date is mirrored'
);
select lives_ok(
  $$select public.record_form_submission('vista-visit', repeat('f', 40), 'Divya Krishnan', '919840012347', null, '{"visit_date":"not a date"}', '[]', null, null, null)$$,
  'a site visit with no valid date is still stored'
);
select is(
  (select project_lead_id from public.form_submissions where visitor_hash = repeat('f', 40)),
  null::uuid,
  'it is not mirrored'
);

-- A name too short for a lead is stored, not mirrored
select lives_ok(
  $$select public.record_form_submission('project-enquiry', repeat('9', 40), 'A', '919840012348', null, '{}', '[]', null, 'kadal-vista', null)$$,
  'a one-letter name is stored'
);
select is(
  (select project_lead_id from public.form_submissions where visitor_hash = repeat('9', 40)),
  null::uuid,
  'it is not mirrored into project_leads'
);

-- A project of a deactivated builder is not visible: no project, no lead (BR-94)
select lives_ok(
  $$select public.record_form_submission('nila-form', repeat('8', 40), 'Arun Kumar', '919840012346', null, '{}', '[]', null, null, null)$$,
  'a form for a project that is not visible still stores the submission'
);
select results_eq(
  $$select project_id is null, project_lead_id is null from public.form_submissions where visitor_hash = repeat('8', 40)$$,
  $$values (true, true)$$,
  'it has no project and no lead'
);

-- What cannot be submitted
select throws_ok(
  $$select public.record_form_submission('old-form', repeat('a', 40), 'Priya Raman', '919840012345', null, '{}', '[]', null, null, null)$$,
  'P0002', 'form.not_found', 'an inactive form is not found'
);
select throws_ok(
  $$select public.record_form_submission('hidden-form', repeat('a', 40), 'Priya Raman', '919840012345', null, '{}', '[]', null, null, null)$$,
  'P0002', 'form.not_found', 'a form shown nowhere is not found'
);
select throws_ok(
  $$select public.record_form_submission('no-such-form', repeat('a', 40), 'Priya Raman', '919840012345', null, '{}', '[]', null, null, null)$$,
  'P0002', 'form.not_found', 'an unknown form is not found'
);

select throws_ok(
  $$select public.record_form_submission('contact-form', 'not-a-hash', 'Priya Raman', '919840012345', null, '{}', '[]', null, null, null)$$,
  '22023', 'form.visitor', 'a visitor that is not a 40 character hash is refused'
);

select * from finish();
rollback;
