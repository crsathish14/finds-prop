-- F05 forms, submissions and the CRM log. Tests: DB-CON-forms, DB-RLS-forms-*,
-- DB-RLS-form_submissions, DB-RLS-crm_api_logs, DB-CON-history-kept, DB-TRG-projects-form-admin-only.
begin;
select plan(37);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'customer1@example.test', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.user_roles (user_id, role)
values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at)
values ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now());
insert into public.crm_integrations (id, name, base_url)
values ('00000000-0000-4000-f000-000000000001', 'Sample CRM', 'https://api.crm.example');

-- F1 is the active standard form, F2 is inactive, F3 belongs to one project and has a CRM link.
insert into public.forms (id, name, slug, kind, placement, active) values
  ('00000000-0000-4000-f100-000000000001', 'Standard enquiry form', 'enquiry', 'enquiry', 'none', true),
  ('00000000-0000-4000-f100-000000000002', 'Old brochure form', 'brochure', 'brochure', 'project', false);
insert into public.forms (id, name, slug, kind, placement, project_id, crm_integration_id, fields) values
  ('00000000-0000-4000-f100-000000000003', 'Kadal Vista site visit', 'kadal-vista-visit', 'site_visit',
   'project_specific', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-f000-000000000001',
   '[{"label": "Name", "key": "name", "type": "text", "required": true}]');
insert into public.form_submissions (id, form_id, form_name, project_id, crm_integration_id, name, mobile, crm_status)
values (
  '00000000-0000-4000-f200-000000000001', '00000000-0000-4000-f100-000000000003', 'Kadal Vista site visit',
  '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-f000-000000000001', 'Priya', '9876543210', 'failed'
);
insert into public.crm_api_logs (id, integration_id, integration_name, submission_id, form_name, outcome, http_status)
values (
  '00000000-0000-4000-f300-000000000001', '00000000-0000-4000-f000-000000000001', 'Sample CRM',
  '00000000-0000-4000-f200-000000000001', 'Kadal Vista site visit', 'failed', 502
);

-- DB-CON-forms
select throws_ok(
  $$insert into public.forms (name, slug, kind, project_id)
    values ('Loose Project', 'loose-project', 'enquiry', '00000000-0000-4000-c000-000000000001')$$,
  '23514', null, 'a form is tied to a project only when its placement says so'
);
select throws_ok(
  $$insert into public.forms (name, slug, kind) values ('Bad Kind', 'bad-kind', 'newsletter')$$,
  '23514', null, 'a form kind comes from the closed list'
);
select throws_ok(
  $$insert into public.forms (name, slug, kind, fields) values ('Bad Fields', 'bad-fields', 'enquiry', '{}')$$,
  '23514', null, 'the fields of a form are a list'
);
select throws_ok(
  $$insert into public.forms (name, slug, kind, fields)
    values ('Too Many', 'too-many', 'enquiry', (select jsonb_agg('{}'::jsonb) from generate_series(1, 31)))$$,
  '23514', null, 'a form has at most 30 fields'
);
select throws_ok(
  $$insert into public.forms (name, slug, kind) values ('Same Slug', 'enquiry', 'enquiry')$$,
  '23505', null, 'a form slug is unique'
);

-- DB-CON submissions and logs
select throws_ok(
  $$insert into public.form_submissions (form_name, mobile) values ('Standard enquiry form', 'abc')$$,
  '23514', null, 'a submitted mobile number is digits only'
);
select throws_ok(
  $$insert into public.form_submissions (form_name, files) values ('Standard enquiry form', '["a", "b", "c", "d"]')$$,
  '23514', null, 'BR-62: a submission holds at most 3 files'
);
select throws_ok(
  $$insert into public.form_submissions (form_name, crm_attempts) values ('Standard enquiry form', 7)$$,
  '23514', null, 'BR-66: at most 6 delivery attempts'
);
select throws_ok(
  $$insert into public.form_submissions (form_name, idempotency_key)
    values ('Standard enquiry form', '00000000-0000-4000-9999-000000000001'),
           ('Standard enquiry form', '00000000-0000-4000-9999-000000000001')$$,
  '23505', null, 'a repeated submission key is refused'
);

-- Visitors, customers and builders see active forms, never the CRM link
set local role anon;
select is((select count(*) from public.forms)::int, 3, 'anon sees only active forms');
select lives_ok(
  $$select id, name, slug, kind, placement, project_id, button_text, success_message, fields from public.forms$$,
  'anon can read the public form columns'
);
select throws_ok($$select crm_integration_id from public.forms$$, '42501', null, 'anon cannot read the CRM link');
select throws_ok($$select * from public.forms$$, '42501', null, 'anon cannot select every column');
select throws_ok(
  $$insert into public.forms (name, slug, kind) values ('Anon Form', 'anon-form', 'enquiry')$$,
  '42501', null, 'anon cannot create a form'
);
select throws_ok($$select * from public.form_submissions$$, '42501', null, 'anon cannot read submissions');
select throws_ok($$select * from public.crm_api_logs$$, '42501', null, 'anon cannot read the CRM log');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*) from public.forms)::int, 3, 'a customer sees only active forms');
select is((select count(*) from public.admin_forms())::int, 0, 'admin_forms is empty for a customer');
select is((select count(*) from public.form_submissions)::int, 0, 'a customer sees no submissions');
select is((select count(*) from public.crm_api_logs)::int, 0, 'a customer sees no CRM log');
select throws_ok(
  $$insert into public.forms (name, slug, kind) values ('Customer Form', 'customer-form', 'enquiry')$$,
  '42501', null, 'a customer cannot create a form'
);

-- A builder: forms are not theirs, and the form link on a project is the admin's
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*) from public.form_submissions)::int, 0, 'a builder sees no submissions');
select throws_ok(
  $$update public.projects set form_id = '00000000-0000-4000-f100-000000000001'
    where id = '00000000-0000-4000-c000-000000000001'$$,
  'P0001', 'projects.form_admin_only', 'a builder cannot pick the form of a project'
);
select throws_ok(
  $$insert into public.projects (slug, name, locality, form_id)
    values ('with-form', 'With Form', 'Adyar', '00000000-0000-4000-f100-000000000001')$$,
  'P0001', 'projects.initial_values', 'a builder cannot create a project with a form'
);

-- The admin
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select is((select count(*) from public.admin_forms())::int, 4, 'the admin reads every form through admin_forms');
select ok(
  (select crm_integration_id is not null from public.admin_forms() where slug = 'kadal-vista-visit'),
  'admin_forms includes the CRM link'
);
select cmp_ok((select count(*) from public.form_submissions)::int, '>=', 1, 'the admin reads submissions');
select cmp_ok((select count(*) from public.crm_api_logs)::int, '>=', 1, 'the admin reads the CRM log');
select lives_ok(
  $$insert into public.forms (name, slug, kind) values ('Contact', 'contact-test', 'contact')$$,
  'the admin can create a form'
);
select lives_ok(
  $$update public.forms set button_text = 'Book a visit' where slug = 'kadal-vista-visit'$$,
  'the admin can edit a form'
);
select throws_ok(
  $$insert into public.form_submissions (form_name) values ('Admin Made')$$,
  '42501', null, 'not even the admin writes submissions from a client'
);
select lives_ok(
  $$update public.projects set form_id = '00000000-0000-4000-f100-000000000001'
    where id = '00000000-0000-4000-c000-000000000001'$$,
  'the admin can pick the form of a project'
);
select lives_ok(
  $$delete from public.forms where slug = 'kadal-vista-visit'$$,
  'the admin can delete a form'
);
reset role;

-- History is kept when a form or a CRM connection is deleted
select ok(
  (select form_id is null and form_name = 'Kadal Vista site visit'
   from public.form_submissions where id = '00000000-0000-4000-f200-000000000001'),
  'deleting a form keeps its submissions, with the form name copied'
);
delete from public.crm_integrations where id = '00000000-0000-4000-f000-000000000001';
select ok(
  (select integration_id is null and integration_name = 'Sample CRM'
   from public.crm_api_logs where id = '00000000-0000-4000-f300-000000000001'),
  'deleting a CRM connection keeps its delivery log, with the name copied'
);
select ok(
  (select crm_integration_id is null from public.form_submissions where id = '00000000-0000-4000-f200-000000000001'),
  'deleting a CRM connection unlinks its submissions'
);

-- Deleting a form unlinks the projects that chose it
delete from public.forms where id = '00000000-0000-4000-f100-000000000001';
select ok(
  (select form_id is null from public.projects where id = '00000000-0000-4000-c000-000000000001'),
  'deleting a form clears the project''s form link'
);

select * from finish();
rollback;
