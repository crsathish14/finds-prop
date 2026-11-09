-- F04 follow-up: the admin's project moderation (S7-T04). Tests: DB-FN-moderate_project, DB-FN-admin_project_overview,
-- DB-PRIV-project-moderation, DB-CON-project_leads-restrict (BR-44).
begin;
select plan(36);

-- ad is the reserved admin; b1 is a builder; c1 is a customer.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes');

-- 1 pending; 2 approved, not published; 3 approved and published; 4 live with two leads and two pictures;
-- 5 pending; 6 pending but still published and featured (a live project a builder edited); 7 pending.
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, featured, images, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'p-one', 'Project One', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'pending', false, false, '{}', null),
  ('00000000-0000-4000-c000-000000000002', 'p-two', 'Project Two', '00000000-0000-4000-b000-000000000001', 'Adyar', 'approved', false, false, '{}', now()),
  ('00000000-0000-4000-c000-000000000003', 'p-three', 'Project Three', '00000000-0000-4000-b000-000000000001', 'Guindy', 'approved', true, false, '{}', now()),
  ('00000000-0000-4000-c000-000000000004', 'p-four', 'Project Four', '00000000-0000-4000-b000-000000000001', 'Velachery', 'approved', true, false, '{a/1.jpg,a/2.jpg}', now()),
  ('00000000-0000-4000-c000-000000000005', 'p-five', 'Project Five', '00000000-0000-4000-b000-000000000001', 'Porur', 'pending', false, false, '{}', null),
  ('00000000-0000-4000-c000-000000000006', 'p-six', 'Project Six', '00000000-0000-4000-b000-000000000001', 'Tambaram', 'pending', true, true, '{}', now()),
  ('00000000-0000-4000-c000-000000000007', 'p-seven', 'Project Seven', '00000000-0000-4000-b000-000000000001', 'Anna Nagar', 'pending', false, false, '{}', null);
insert into public.project_leads (project_id, kind, name, phone) values
  ('00000000-0000-4000-c000-000000000004', 'enquiry', 'Arjun Menon', '9841055512'),
  ('00000000-0000-4000-c000-000000000004', 'brochure', 'Divya Krishnan', '9884021098');

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);

-- approve
select is(
  (select moderation from public.moderate_project('00000000-0000-4000-c000-000000000001', 'approve')),
  'approved', 'approving a pending project makes it approved'
);
select results_eq(
  $$select moderation, rejection_reason is null, moderated_by, moderated_at is not null
    from public.projects where id = '00000000-0000-4000-c000-000000000001'$$,
  $$values ('approved', true, '00000000-0000-4000-8000-0000000000ad'::uuid, true)$$,
  'with the admin and the time recorded, and no reason'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000001', 'approve')$$, '55000',
  'project.not_reviewable', 'an approved project cannot be approved again'
);

-- reject
select is(
  (select moderation from public.moderate_project('00000000-0000-4000-c000-000000000005', 'reject')),
  'rejected', 'rejecting a pending project makes it rejected'
);
select results_eq(
  $$select moderation, rejection_reason, published from public.projects where id = '00000000-0000-4000-c000-000000000005'$$,
  $$values ('rejected', 'Rejected by an admin.', false)$$,
  'with a short fixed reason when none is given, as the table needs one'
);
select results_eq(
  $$select p.rejection_reason
    from public.moderate_project('00000000-0000-4000-c000-000000000007', 'reject', '  Brochure is missing  ') as decided
    join public.projects as p on p.id = decided.id$$,
  $$values ('Brochure is missing')$$,
  'or the reason that is given, trimmed'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000002', 'reject')$$, '55000',
  'project.not_reviewable', 'only a pending project can be rejected'
);

-- a rejected project can be approved later
select is(
  (select moderation from public.moderate_project('00000000-0000-4000-c000-000000000005', 'approve')),
  'approved', 'a rejected project can be approved later'
);
select is(
  (select rejection_reason from public.projects where id = '00000000-0000-4000-c000-000000000005'),
  null, 'which clears the reason'
);

-- rejecting a live project that a builder edited takes it off the site completely
select results_eq(
  $$select published, featured from public.moderate_project('00000000-0000-4000-c000-000000000006', 'reject')$$,
  $$values (false, false)$$,
  'a rejected project is neither published nor featured'
);

-- publish and unpublish
select is(
  (select published from public.moderate_project('00000000-0000-4000-c000-000000000002', 'publish')),
  true, 'an approved project can be published'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000002', 'publish')$$, '55000',
  'project.not_publishable', 'a published project cannot be published again'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000007', 'publish')$$, '55000',
  'project.not_publishable', 'a project that is not approved cannot be published'
);
select is(
  (select published from public.moderate_project('00000000-0000-4000-c000-000000000002', 'unpublish')),
  false, 'a published project can be unpublished'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000002', 'unpublish')$$, '55000',
  'project.not_publishable', 'an unpublished project cannot be unpublished again'
);

-- feature and unfeature
select is(
  (select featured from public.moderate_project('00000000-0000-4000-c000-000000000003', 'feature')),
  true, 'an approved project can be featured'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000007', 'feature')$$, '55000',
  'project.not_featurable', 'a project that is not approved cannot be featured'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000003', 'feature')$$, '55000',
  'project.not_featurable', 'a featured project cannot be featured again'
);
select is(
  (select featured from public.moderate_project('00000000-0000-4000-c000-000000000003', 'unfeature')),
  false, 'a featured project can be removed from featured'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000003', 'unfeature')$$, '55000',
  'project.not_featurable', 'a project that is not featured cannot be removed from featured'
);

-- bad calls
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000003', 'delete')$$, '22023',
  'project.bad_action', 'an action that is not one of the six is refused'
);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-0000000000ff', 'approve')$$, 'P0002',
  'project.not_found', 'a project that does not exist is not found'
);

-- the overview
select results_eq(
  $$select name, builder_name, leads::int, cover from public.admin_project_overview() where id = '00000000-0000-4000-c000-000000000004'$$,
  $$values ('Project Four', 'Kadal Homes', 2, 'a/1.jpg')$$,
  'the admin sees each project with its builder, its number of leads and its first picture'
);
select is(
  (select count(*) from public.admin_project_overview())::int, 7, 'and every project, whatever its state'
);

-- delete (BR-44)
select throws_ok(
  $$delete from public.projects where id = '00000000-0000-4000-c000-000000000004'$$, '23503',
  null, 'a project with leads cannot be deleted'
);
select lives_ok(
  $$delete from public.projects where id = '00000000-0000-4000-c000-000000000002'$$,
  'a project without leads can be deleted by the admin'
);
select is(
  (select count(*) from public.projects where id = '00000000-0000-4000-c000-000000000002')::int, 0,
  'and it is gone'
);

-- A builder is refused everything, and cannot delete
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000003', 'unpublish')$$, '42501',
  'project.not_allowed', 'a builder cannot moderate, not even their own project'
);
select throws_ok(
  $$select * from public.admin_project_overview()$$, '42501', 'project.not_allowed',
  'a builder cannot read the admin''s list'
);
select lives_ok(
  $$delete from public.projects where id = '00000000-0000-4000-c000-000000000003'$$,
  'a builder''s delete finds nothing to delete (only the admin''s policy allows it)'
);
select is(
  (select count(*) from public.projects where id = '00000000-0000-4000-c000-000000000003')::int, 1,
  'and the project is still there'
);

-- A customer is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000003', 'unpublish')$$, '42501',
  'project.not_allowed', 'a customer cannot moderate'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.moderate_project('00000000-0000-4000-c000-000000000003', 'unpublish')$$, '42501', null,
  'a visitor cannot call it (no execute grant)'
);
reset role;

select is(
  (select count(*) from information_schema.routine_privileges
   where routine_schema = 'public' and routine_name in ('moderate_project', 'admin_project_overview')
     and grantee in ('PUBLIC', 'anon'))::int,
  0, 'neither function is granted to the public or to visitors'
);
select is(
  (select prosecdef from pg_proc where proname = 'moderate_project' and pronamespace = 'public'::regnamespace),
  true, 'the decision function is a definer function, so it can change what the guard keeps for the system'
);
select is(
  (select prosecdef from pg_proc where proname = 'admin_project_overview' and pronamespace = 'public'::regnamespace),
  true, 'and so is the overview, which reads across the builders'' rows'
);

select * from finish();
rollback;
