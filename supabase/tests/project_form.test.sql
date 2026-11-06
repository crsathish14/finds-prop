-- F05 forms (S5-T05, change 4): public_project_form() and the project a chosen form belongs to.
-- Tests: DB-FN-public_project_form (BR-49 fallback chain, BR-94 visibility), DB-FN-record_form_submission
-- (a form chosen through projects.form_id may have any placement).
begin;
select plan(16);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000e1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000e2', 'builder2@example.test', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'builder'),
  ('00000000-0000-4000-8000-0000000000e2', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', 'builder1@example.test', 'Kadal Homes'),
  ('00000000-0000-4000-b000-0000000000e2', '00000000-0000-4000-8000-0000000000e2', 'builder2@example.test', 'Nila Habitats');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-0000000000e1', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-0000000000e1', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-0000000000e2', 'nila-heights', 'Nila Heights', '00000000-0000-4000-b000-0000000000e2', 'Adyar', 'approved', true, now()),
  ('00000000-0000-4000-c000-0000000000e3', 'draft-tower', 'Draft Tower', '00000000-0000-4000-b000-0000000000e1', 'Guindy', 'pending', false, null),
  ('00000000-0000-4000-c000-0000000000e4', 'other-project', 'Other Project', '00000000-0000-4000-b000-0000000000e1', 'Velachery', 'approved', true, now());
-- The second builder is deactivated: its approved, published project is not visible (BR-94).
update public.builders set active = false where id = '00000000-0000-4000-b000-0000000000e2';

-- Only the form shown on every project page to start with; the other tiers are added step by step.
insert into public.forms (id, name, slug, kind, placement, project_id, fields, active)
values ('00000000-0000-4000-d000-0000000000e1', 'All projects', 'all-projects', 'enquiry', 'project', null, '[]', true);

-- Visitors may call it, and it never returns the CRM link
select ok(
  has_function_privilege('anon', 'public.public_project_form(text)', 'execute'),
  'a visitor can call public_project_form'
);
select is(
  (select array_agg(arg order by ord) from (
     select unnest(proargnames) as arg, generate_series(1, array_length(proargnames, 1)) as ord
     from pg_proc where proname = 'public_project_form'
   ) names where arg not like 'p\_%'),
  array['slug', 'name', 'kind', 'placement', 'project_id', 'button_text', 'success_message', 'fields'],
  'it returns only the columns a visitor may see, never the CRM link'
);

-- Tier 3: the form shown on every project page
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'all-projects',
  'with nothing more specific, a project shows the form placed on every project page'
);
select is(
  (select slug from public.public_project_form('draft-tower')),
  null,
  'a project that is not approved and published shows no form (BR-94)'
);
select is(
  (select slug from public.public_project_form('nila-heights')),
  null,
  'a project of a deactivated builder shows no form (BR-94)'
);
select is(
  (select count(*) from public.public_project_form('no-such-project')),
  0::bigint,
  'an unknown project shows no form'
);

-- Tier 2: a form made for this project alone
insert into public.forms (id, name, slug, kind, placement, project_id, fields, active)
values ('00000000-0000-4000-d000-0000000000e6', 'Nila only', 'nila-only', 'site_visit', 'project_specific', '00000000-0000-4000-c000-0000000000e2', '[]', true);
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'all-projects',
  'a form made for another project does not count'
);
insert into public.forms (id, name, slug, kind, placement, project_id, fields, active)
values ('00000000-0000-4000-d000-0000000000e2', 'Vista only', 'vista-only', 'site_visit', 'project_specific', '00000000-0000-4000-c000-0000000000e1', '[]', true);
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'vista-only',
  'a form made for this project alone wins over the all-projects form'
);

-- Tier 1: the form the admin chose (any placement except none), when it is active
insert into public.forms (id, name, slug, kind, placement, project_id, fields, active) values
  ('00000000-0000-4000-d000-0000000000e3', 'Chosen', 'chosen-form', 'callback', 'contact', null, '[]', true),
  ('00000000-0000-4000-d000-0000000000e5', 'Chosen but hidden', 'chosen-hidden', 'callback', 'none', null, '[]', true),
  ('00000000-0000-4000-d000-0000000000e7', 'Chosen enquiry', 'chosen-enquiry', 'enquiry', 'contact', null, '[]', true);
update public.projects set form_id = '00000000-0000-4000-d000-0000000000e3' where slug = 'kadal-vista';
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'chosen-form',
  'the form the admin chose wins, whatever its placement'
);
update public.forms set active = false where slug = 'chosen-form';
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'vista-only',
  'a chosen form that is not active is skipped and the chain goes on'
);
update public.projects set form_id = '00000000-0000-4000-d000-0000000000e5' where slug = 'kadal-vista';
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'vista-only',
  'a chosen form that is shown nowhere is skipped and the chain goes on'
);

-- A visitor gets the same answer without any table access
set local role anon;
select is(
  (select slug from public.public_project_form('kadal-vista')),
  'vista-only',
  'a visitor with no table access gets the answer through the function'
);
reset role;

-- The project a chosen form belongs to
update public.forms set active = true where slug = 'chosen-form';
update public.projects set form_id = '00000000-0000-4000-d000-0000000000e3' where slug = 'kadal-vista';
select ok(
  public.record_form_submission('chosen-form', repeat('a', 40), 'Priya Raman', '919840012345', null, '{}', '[]',
    '/projects/kadal-vista', 'kadal-vista', '00000000-0000-4000-8000-0000000000a1') is not null,
  'a submission of a chosen form is stored'
);
select is(
  (select project_id::text from public.form_submissions where idempotency_key = '00000000-0000-4000-8000-0000000000a1'),
  '00000000-0000-4000-c000-0000000000e1',
  'it belongs to the project that chose the form, although the form is placed on the contact page'
);
select public.record_form_submission('chosen-form', repeat('a', 40), 'Priya Raman', '919840012345', null, '{}', '[]',
  '/projects/other-project', 'other-project', '00000000-0000-4000-8000-0000000000a2');
select is(
  (select project_id from public.form_submissions where idempotency_key = '00000000-0000-4000-8000-0000000000a2'),
  null,
  'a project that did not choose the form does not count: the submission has no project'
);

-- A chosen enquiry form with a name and a phone is mirrored into the project's leads (BR-63)
update public.projects set form_id = '00000000-0000-4000-d000-0000000000e7' where slug = 'kadal-vista';
select public.record_form_submission('chosen-enquiry', repeat('b', 40), 'Priya Raman', '919840012345', null,
  '{"message":"Hello"}', '[]', '/projects/kadal-vista', 'kadal-vista', '00000000-0000-4000-8000-0000000000a3');
select is(
  (select (select count(*) from public.project_leads where id = submission.project_lead_id and project_id = submission.project_id and phone = '919840012345')
     from public.form_submissions submission where submission.idempotency_key = '00000000-0000-4000-8000-0000000000a3'),
  1::bigint,
  'a chosen enquiry form with a name and a phone is mirrored into the project''s leads'
);

select * from finish();
rollback;
