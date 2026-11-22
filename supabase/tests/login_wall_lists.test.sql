-- Login wall, part B: the projects list is for signed-in visitors only. Tests: DB-FN-live-project-list (BR-42, BR-94).
-- live_project_list() runs with the owner's rights and repeats the row rule of the public policy, so a signed-in
-- visitor gets exactly the live projects of active builders; a visitor who is not signed in is refused.
-- Fictional data only.
begin;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder');
insert into public.builders (id, user_id, email, name, active) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes', true),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'builder2@example.test', 'Closed Homes', false);
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at, featured, images) values
  ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista', '00000000-0000-4000-b000-000000000001',
    'OMR Navalur', 'approved', true, now(), false, array['kadal/cover.webp']),
  ('00000000-0000-4000-c000-000000000002', 'hidden-vista', 'Hidden Vista', '00000000-0000-4000-b000-000000000001',
    'OMR Navalur', 'approved', false, now(), false, '{}'),
  ('00000000-0000-4000-c000-000000000003', 'closed-vista', 'Closed Vista', '00000000-0000-4000-b000-000000000002',
    'OMR Navalur', 'approved', true, now(), false, '{}'),
  ('00000000-0000-4000-c000-000000000004', 'featured-vista', 'Featured Vista', '00000000-0000-4000-b000-000000000001',
    'Adyar', 'approved', true, now(), true, '{}');

set local role authenticated;

select is(
  (select jsonb_agg(entry ->> 'slug') from jsonb_array_elements(public.live_project_list()) as entry),
  '["featured-vista", "kadal-vista"]'::jsonb,
  'a signed-in visitor gets the live projects of active builders, featured first, and no other'
);
select is(
  public.live_project_list() -> 1 -> 'builders' ->> 'name',
  'Kadal Homes',
  'each project comes with its builder'
);
select is(
  public.live_project_list() -> 1 -> 'images',
  '["kadal/cover.webp"]'::jsonb,
  'each project comes with its pictures'
);
select ok(
  not (public.live_project_list() -> 0) ?| array['moderation', 'published', 'address', 'latitude', 'longitude', 'form_id'],
  'no moderation state, address, coordinates or form link comes with a project'
);
select is(
  jsonb_array_length(public.live_project_list(1)),
  1,
  'the number asked for is kept'
);

select is(
  public.live_locality_names() -> 'projects',
  '["Adyar", "OMR Navalur"]'::jsonb,
  'live_locality_names gives the localities of live projects of active builders only'
);
select is(
  public.live_locality_names() ->> 'projects_complete',
  'true',
  'live_locality_names says when a read is complete'
);
select is(
  (public.live_builder_projects('00000000-0000-4000-b000-000000000001') ->> 'project_count')::int,
  2,
  'live_builder_projects counts only the live projects of the builder'
);
select is(
  (select jsonb_agg(entry ->> 'slug' order by entry ->> 'slug')
   from jsonb_array_elements(public.live_builder_projects('00000000-0000-4000-b000-000000000001') -> 'projects') as entry),
  '["featured-vista", "kadal-vista"]'::jsonb,
  'live_builder_projects gives no project that is not published'
);
select is(
  public.live_builder_projects('00000000-0000-4000-b000-000000000002'),
  null,
  'live_builder_projects gives nothing for an inactive builder'
);

set local role anon;

select throws_ok(
  $$select public.live_locality_names()$$,
  '42501',
  null,
  'live_locality_names refuses a visitor who is not signed in'
);

select throws_ok(
  $$select public.live_project_list()$$,
  '42501',
  null,
  'a visitor who is not signed in is refused'
);

reset role;
select * from finish();
rollback;
