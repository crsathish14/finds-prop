-- Header city selector, part 3: projects have a city. Tests: DB-FN-project-city (BR-42, BR-94, ADR-017).
-- The trigger adds only the city, listed_cities() counts live projects, and the two project reads can be limited
-- to one city. Fictional data only.
begin;
select plan(8);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name, active) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes', true);

insert into public.projects (id, slug, name, builder_id, city, locality, moderation, published, moderated_at, images) values
  ('00000000-0000-4000-c000-000000000001', 'madurai-vista', 'Madurai Vista', '00000000-0000-4000-b000-000000000001',
    'madurai ', 'Anna Nagar', 'approved', true, now(), '{}'),
  ('00000000-0000-4000-c000-000000000002', 'madurai-two', 'Madurai Two', '00000000-0000-4000-b000-000000000001',
    'Madurai', 'KK Nagar', 'approved', true, now(), '{}'),
  ('00000000-0000-4000-c000-000000000003', 'chennai-vista', 'Chennai Vista', '00000000-0000-4000-b000-000000000001',
    'Chennai', 'Adyar', 'approved', true, now(), '{}'),
  ('00000000-0000-4000-c000-000000000004', 'draft-vista', 'Draft Vista', '00000000-0000-4000-b000-000000000001',
    'Salem', 'Fairlands', 'pending', false, null, '{}');

select is((select count(*) from public.cities where key = 'madurai'), 1::bigint, 'two spellings of one city make one row');
select is((select name from public.cities where key = 'madurai'), 'Madurai', 'the name is tidy');
select is(
  (select count(*) from public.cities where key in ('annanagar', 'kknagar', 'adyar')), 0::bigint,
  'only the city is added, never the locality'
);
select is(
  (select listing_count from public.listed_cities() where key = 'madurai'), 2::bigint,
  'listed_cities counts the live projects of a city'
);
select is(
  (select count(*) from public.listed_cities() where key = 'salem'), 0::bigint,
  'a city with only an unapproved project is not listed'
);

set local role authenticated;

select is(
  (select jsonb_agg(entry ->> 'slug' order by entry ->> 'slug')
   from jsonb_array_elements(public.live_project_list(p_city => ' Madurai.')) as entry),
  '["madurai-two","madurai-vista"]'::jsonb,
  'the projects list keeps only the chosen city, whatever the spelling of the key'
);
select is(
  jsonb_array_length(public.live_project_list()), 3, 'without a city the list has every live project'
);

set local role anon;

select is(
  (select jsonb_agg(entry ->> 'slug' order by entry ->> 'slug')
   from jsonb_array_elements(public.home_developers('chennai')) as entry),
  '["chennai-vista"]'::jsonb,
  'the homepage developers can be limited to one city'
);

reset role;
select * from finish();
rollback;
