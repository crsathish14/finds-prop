-- F04 projects, units and price trends. Tests: DB-CON-projects, DB-RLS-projects-*,
-- DB-TRG-projects-guard, DB-TRG-units-project-lock, DB-RLS-units, DB-RLS-price_trends.
begin;
select plan(69);

-- b1 and b2 are builders (records B1 and B2), c1 is a customer, ad is the reserved admin.
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

create function pg_temp.new_project(
  project uuid,
  builder uuid,
  project_slug text,
  project_moderation text default 'approved',
  is_published boolean default true
) returns uuid
language sql
as $$
  insert into public.projects (
    id, slug, name, builder_id, locality, moderation, published, moderated_at, rejection_reason,
    latitude, longitude
  ) values (
    project, project_slug, 'Project ' || project_slug, builder, 'OMR Navalur', project_moderation,
    is_published,
    case when project_moderation in ('approved', 'rejected') then now() end,
    case when project_moderation = 'rejected' then 'Needs better photos' end,
    13.0827, 80.2707
  ) returning id
$$;

-- P1, P2 and P5 are live; P3 is pending; P4 is approved but unpublished; P6 is rejected.
select pg_temp.new_project('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'kadal-vista');
select pg_temp.new_project('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 'sea-pearl');
select pg_temp.new_project('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000001', 'new-launch', 'pending', false);
select pg_temp.new_project('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000002', 'hidden-gem', 'approved', false);
select pg_temp.new_project('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000002', 'thendral-heights');
select pg_temp.new_project('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000001', 'rejected-one', 'rejected', false);

insert into public.project_units (id, project_id, unit_number, bhk, price) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', 'A-101', 2, 7500000),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000004', 'B-201', 3, 9500000);
insert into public.project_price_trends (project_id, month, price_per_sqft) values
  ('00000000-0000-4000-c000-000000000001', '2026-10-01', 8350),
  ('00000000-0000-4000-c000-000000000004', '2026-10-01', 9100);

-- DB-CON-projects
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, price_min, price_max)
    values ('bad-price', 'Bad Price', '00000000-0000-4000-b000-000000000001', 'Adyar', 10, 5)$$,
  '23514', null, 'the lowest price cannot exceed the highest'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, latitude)
    values ('half-point', 'Half Point', '00000000-0000-4000-b000-000000000001', 'Adyar', 13.0)$$,
  '23514', null, 'latitude and longitude come together'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, rera_number)
    values ('rera-first', 'Rera First', '00000000-0000-4000-b000-000000000001', 'Adyar', 'TN/01/2026')$$,
  '23514', null, 'a RERA number needs RERA applicable'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, moderation)
    values ('no-reason', 'No Reason', '00000000-0000-4000-b000-000000000001', 'Adyar', 'rejected')$$,
  '23514', null, 'a rejection needs a reason'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality)
    values ('Bad Slug', 'Bad Slug', '00000000-0000-4000-b000-000000000001', 'Adyar')$$,
  '23514', null, 'a slug is lower case words and dashes'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, bhk_options)
    values ('bhk-range', 'Bhk Range', '00000000-0000-4000-b000-000000000001', 'Adyar', '{11}')$$,
  '23514', null, 'BHK options stay within 0 to 10'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality)
    values ('kadal-vista', 'Another', '00000000-0000-4000-b000-000000000001', 'Adyar')$$,
  '23505', null, 'a slug is unique'
);
-- DB-CON-projects-form (ADR-148): the columns of the project form change.
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, price, price_type)
    values ('zero-price', 'Zero Price', '00000000-0000-4000-b000-000000000002', 'Adyar', 0, 'basic')$$,
  '23514', null, 'the price is more than zero'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, price, price_type)
    values ('odd-type', 'Odd Type', '00000000-0000-4000-b000-000000000002', 'Adyar', 100, 'weekly')$$,
  '23514', null, 'the price type is one of the five'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, price, price_type)
    values ('rent-no-offer', 'Rent No Offer', '00000000-0000-4000-b000-000000000002', 'Adyar', 100, 'rent_per_month')$$,
  '23514', null, 'a rent price type needs a project for rent'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, offer_type, price, price_type)
    values ('sale-for-rent', 'Sale For Rent', '00000000-0000-4000-b000-000000000002', 'Adyar', 'rent', 100, 'all_inclusive')$$,
  '23514', null, 'a sale price type does not go with a project for rent'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, offer_type)
    values ('lease-offer', 'Lease Offer', '00000000-0000-4000-b000-000000000002', 'Adyar', 'lease')$$,
  '23514', null, 'a project is offered for sale or for rent'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, area_min_sqft, area_max_sqft)
    values ('area-back', 'Area Back', '00000000-0000-4000-b000-000000000002', 'Adyar', 2000, 1000)$$,
  '23514', null, 'the smallest area cannot exceed the largest'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, area_min_sqft)
    values ('area-half', 'Area Half', '00000000-0000-4000-b000-000000000002', 'Adyar', 1000)$$,
  '23514', null, 'the smallest and the largest area come together'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, rera_not_applicable_reason)
    values ('blank-reason', 'Blank Reason', '00000000-0000-4000-b000-000000000002', 'Adyar', '   ')$$,
  '23514', null, 'the reason RERA does not apply is not blank'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, property_type)
    values ('odd-property', 'Odd Property', '00000000-0000-4000-b000-000000000002', 'Adyar', 'house')$$,
  '23514', null, 'the property type is one of the seven'
);
select lives_ok(
  $$insert into public.projects (
      slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type,
      area_min_sqft, area_max_sqft
    ) values (
      'office-for-rent', 'Office For Rent', '00000000-0000-4000-b000-000000000002', 'Adyar', 'commercial',
      'office', 'rent', 85, 'rent_per_sqft_month', 500, 2500
    )$$,
  'a commercial office for rent with a rent price type and an area range is accepted'
);
select lives_ok(
  $$insert into public.projects (
      slug, name, builder_id, locality, project_type, property_type, price, price_type, area_min_sqft,
      area_max_sqft, rera_applicable, rera_not_applicable_reason
    ) values (
      'plots-by-the-lake', 'Plots By The Lake', '00000000-0000-4000-b000-000000000002', 'Adyar', 'residential',
      'plot', 3500, 'per_sqft', 1200, 2400, false, 'Below the size that needs registration.'
    )$$,
  'a residential plot project priced per sq ft with an area range and a RERA reason is accepted'
);
select ok(
  (select extensions.st_x(location::extensions.geometry) between 80.27 and 80.28
   from public.projects where id = '00000000-0000-4000-c000-000000000001'),
  'the exact location is built from latitude and longitude'
);

-- Visitors
set local role anon;
select is((select count(*) from public.projects)::int, 3, 'BR-42: anon sees only approved and published projects');
select lives_ok(
  $$select slug, name, latitude, longitude, location, rera_number from public.projects$$,
  'anon can read the public columns, including the exact coordinates'
);
select lives_ok(
  $$select offer_type, price, price_type, area_min_sqft, area_max_sqft, rera_not_applicable_reason
    from public.projects$$,
  'anon can read the price, the price type, the area range, the offer type and the RERA reason'
);
select throws_ok($$select moderation from public.projects$$, '42501', null, 'anon cannot read the moderation state');
select throws_ok($$select rejection_reason from public.projects$$, '42501', null, 'anon cannot read the rejection reason');
select throws_ok($$select form_id from public.projects$$, '42501', null, 'anon cannot read the form link');
select throws_ok($$select * from public.projects$$, '42501', null, 'anon cannot select every column');
select is((select count(*) from public.project_units)::int, 1, 'anon sees units of live projects only');
select is((select count(*) from public.project_price_trends)::int, 1, 'anon sees price trends of live projects only');
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality)
    values ('anon-project', 'Anon Project', '00000000-0000-4000-b000-000000000001', 'Adyar')$$,
  '42501', null, 'anon cannot insert a project'
);
reset role;

-- A customer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*) from public.projects)::int, 3, 'a customer sees only live projects');
select is((select count(*) from public.my_projects())::int, 0, 'my_projects is empty for a customer');
select throws_ok(
  $$insert into public.projects (slug, name, locality) values ('cust-project', 'Cust Project', 'Adyar')$$,
  '42501', null, 'a customer cannot create a project'
);
reset role;

-- The builder, b1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select ok(
  exists (select 1 from public.projects where id = '00000000-0000-4000-c000-000000000003'),
  'BR-31: a builder sees their own pending project'
);
select ok(
  not exists (select 1 from public.projects where id = '00000000-0000-4000-c000-000000000004'),
  'BR-31: a builder does not see another builder''s unpublished project'
);
select is((select count(*) from public.my_projects())::int, 4, 'my_projects returns the builder''s four projects');
select is(
  (select moderation from public.my_projects() where id = '00000000-0000-4000-c000-000000000003'),
  'pending',
  'my_projects includes the moderation state'
);
select lives_ok(
  $$insert into public.projects (slug, name, locality) values ('b1-new', 'B1 New Project', 'Adyar')$$,
  'a builder can create a project; the builder link is filled in'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality)
    values ('b1-other', 'B1 Other', '00000000-0000-4000-b000-000000000002', 'Adyar')$$,
  'P0001', 'projects.builder_mismatch', 'BR-43: a builder cannot create a project for another builder'
);
select throws_ok(
  $$insert into public.projects (slug, name, locality, published) values ('b1-pub', 'B1 Published', 'Adyar', true)$$,
  '42501', null, 'a builder cannot publish a project'
);
select throws_ok(
  $$update public.projects set moderation = 'approved' where id = '00000000-0000-4000-c000-000000000003'$$,
  '42501', null, 'a builder cannot approve a project'
);
select lives_ok(
  $$update public.projects set description = 'Now with a clubhouse.' where id = '00000000-0000-4000-c000-000000000002'$$,
  'a builder can edit their live project'
);
select lives_ok(
  $$update public.projects set name = 'Rejected One, Revised' where id = '00000000-0000-4000-c000-000000000006'$$,
  'a builder can revise a rejected project'
);
select lives_ok(
  $$update public.projects
    set price = 4500000, price_type = 'basic', rera_not_applicable_reason = 'Below the size that needs registration.'
    where id = '00000000-0000-4000-c000-000000000006'$$,
  'a builder can write the price, the price type and the RERA reason'
);
select throws_ok(
  $$update public.projects set slug = 'kadal-vista-new' where id = '00000000-0000-4000-c000-000000000001'$$,
  'P0001', 'projects.slug_locked', 'the address of a moderated project is locked for the builder'
);
select throws_ok(
  $$update public.projects set builder_id = '00000000-0000-4000-b000-000000000002' where id = '00000000-0000-4000-c000-000000000003'$$,
  'P0001', 'projects.builder_immutable', 'BR-43: a builder cannot reassign a project'
);
select lives_ok(
  $$update public.projects set description = 'Hijacked' where id = '00000000-0000-4000-c000-000000000005'$$,
  'editing another builder''s project is accepted but matches no rows'
);
select lives_ok(
  $$delete from public.projects where id = '00000000-0000-4000-c000-000000000003'$$,
  'a builder delete is accepted but matches no rows'
);
-- Units belong to the builder's own projects, and changing them does not send the project to review.
select lives_ok(
  $$insert into public.project_units (project_id, unit_number, bhk, price)
    values ('00000000-0000-4000-c000-000000000001', 'A-102', 3, 8200000)$$,
  'a builder can add a unit to their project'
);
select throws_ok(
  $$insert into public.project_units (project_id, unit_number)
    values ('00000000-0000-4000-c000-000000000005', 'Z-1')$$,
  '42501', null, 'a builder cannot add a unit to another builder''s project'
);
select lives_ok(
  $$update public.project_units set status = 'sold' where id = '00000000-0000-4000-d000-000000000001'$$,
  'a builder can change a unit status'
);
select throws_ok(
  $$update public.project_units set project_id = '00000000-0000-4000-c000-000000000002'
    where id = '00000000-0000-4000-d000-000000000001'$$,
  '42501', null, 'BR-45: a unit cannot be moved by a client'
);
select throws_ok(
  $$insert into public.project_price_trends (project_id, month, price_per_sqft)
    values ('00000000-0000-4000-c000-000000000001', '2026-11-01', 8400)$$,
  '42501', null, 'a builder cannot write price trends'
);
reset role;

select ok(
  (select moderation = 'pending' from public.projects where id = '00000000-0000-4000-c000-000000000002'),
  'BR-41: a builder edit sends a live project back to review'
);
select ok(
  (select moderation = 'pending' and rejection_reason is null from public.projects where id = '00000000-0000-4000-c000-000000000006'),
  'BR-41: a revised rejected project returns to review and the reason is cleared'
);
select ok(
  (select moderation = 'pending' and builder_id = '00000000-0000-4000-b000-000000000001'
   from public.projects where slug = 'b1-new'),
  'BR-40: the new project is pending and belongs to the builder'
);
select ok(
  (select moderation = 'approved' from public.projects where id = '00000000-0000-4000-c000-000000000001'),
  'Q3: changing units does not send the project back to review'
);
select ok(
  (select description is distinct from 'Hijacked' from public.projects where id = '00000000-0000-4000-c000-000000000005')
  and exists (select 1 from public.projects where id = '00000000-0000-4000-c000-000000000003'),
  'the other builder''s project is unchanged and the pending project still exists'
);

-- The admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select cmp_ok((select count(*) from public.admin_projects())::int, '>=', 7, 'the admin reads every project');
select lives_ok(
  $$update public.projects set description = 'Edited by the admin.' where id = '00000000-0000-4000-c000-000000000005'$$,
  'the admin can edit a project'
);
select lives_ok(
  $$insert into public.projects (slug, name, builder_id, locality)
    values ('admin-made', 'Admin Made', '00000000-0000-4000-b000-000000000002', 'Adyar')$$,
  'the admin can create a project for a builder'
);
select lives_ok(
  $$insert into public.project_price_trends (project_id, month, price_per_sqft)
    values ('00000000-0000-4000-c000-000000000001', '2026-11-01', 8400)$$,
  'the admin can write price trends'
);
select throws_ok(
  $$insert into public.project_price_trends (project_id, month, price_per_sqft)
    values ('00000000-0000-4000-c000-000000000001', '2026-11-15', 8400)$$,
  '23514', null, 'a price trend month is the first day of the month'
);
select lives_ok(
  $$delete from public.projects where id = '00000000-0000-4000-c000-000000000003'$$,
  'BR-44: the admin can delete a project that has no leads'
);
select throws_ok(
  $$update public.projects set published = false where id = '00000000-0000-4000-c000-000000000005'$$,
  '42501', null, 'the admin changes moderation through functions, not a client grant'
);
reset role;
select ok(
  (select moderation = 'approved' from public.projects where id = '00000000-0000-4000-c000-000000000005'),
  'an admin edit does not send the project back to review'
);
select ok(
  not exists (select 1 from public.projects where id = '00000000-0000-4000-c000-000000000003'),
  'the deleted project is gone'
);

-- Defence in depth: the guard still refuses if a grant were ever widened
grant update (moderation, published, featured) on public.projects to authenticated;
grant update (project_id) on public.project_units to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$update public.projects set published = false where id = '00000000-0000-4000-c000-000000000002'$$,
  'P0001', 'projects.moderation_system_only', 'the guard refuses a builder publishing a project'
);
select throws_ok(
  $$update public.project_units set project_id = '00000000-0000-4000-c000-000000000002'
    where id = '00000000-0000-4000-d000-000000000001'$$,
  'P0001', 'project_units.project_immutable', 'BR-45: the guard refuses moving a unit'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select throws_ok(
  $$update public.projects set featured = true where id = '00000000-0000-4000-c000-000000000005'$$,
  'P0001', 'projects.moderation_system_only', 'the guard refuses even the admin changing moderation directly'
);
reset role;

select * from finish();
rollback;
