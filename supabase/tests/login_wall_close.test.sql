-- Login wall, part C: visitors who are not signed in (anon) can no longer read the lists. Tests: DB-RLS-login-wall
-- (BR-42, BR-90, BR-94, ADR-171). The five tables and search_properties() are closed to anon; signed-in people keep
-- their reads; the narrow functions (part A) still answer one home or one project to everybody. Fictional data only.
begin;
select plan(11);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '919100000001', now());
insert into public.properties (
  id, short_id, owner_id, status, listing_type, property_type, bhk, title, description, price, area_sqft,
  locality, city, state, pincode, address, location, published_at
) values (
  '00000000-0000-4000-9000-000000000001', 'hhhhhha2', '00000000-0000-4000-8000-0000000000a1', 'approved',
  'sale', 'apartment', 2, 'Sea view apartment', 'A bright two bedroom flat near the sea.', 8500000, 950,
  'Adyar', 'Chennai', 'Tamil Nadu', '600020', '12 Beach Road',
  extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography, now()
);
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at)
values ('00000000-0000-4000-c000-000000000001', 'kadal-vista', 'Kadal Vista',
  '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now());

set local role anon;

select throws_ok($$select id from public.properties$$, '42501', null, 'anon cannot read the homes table');
select throws_ok($$select id from public.listing_media$$, '42501', null, 'anon cannot read the photos table');
select throws_ok($$select id from public.projects$$, '42501', null, 'anon cannot read the projects table');
select throws_ok($$select id from public.project_units$$, '42501', null, 'anon cannot read the units table');
select throws_ok($$select id from public.project_price_trends$$, '42501', null, 'anon cannot read the price trends table');
select throws_ok($$select * from public.search_properties()$$, '42501', null, 'anon cannot run the search');

-- The narrow functions still answer to a visitor who is not signed in.
select is(
  public.public_property('hhhhhha2') -> 'property' ->> 'title',
  'Sea view apartment',
  'anon still gets one home by its public id'
);
select is(
  public.public_project('kadal-vista') -> 'project' ->> 'name',
  'Kadal Vista',
  'anon still gets one live project by its slug'
);

set local role authenticated;

select is(
  (select count(*)::int from public.properties where short_id = 'hhhhhha2'),
  1,
  'a signed-in person still reads approved homes'
);
select is(
  (select count(*)::int from public.search_properties(p_limit => 5)),
  1,
  'a signed-in person can run the search'
);
select is(
  (select count(*)::int from public.projects where slug = 'kadal-vista'),
  1,
  'a signed-in person still reads live projects'
);

reset role;
select * from finish();
rollback;
