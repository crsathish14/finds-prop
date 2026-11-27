-- ADR-214 residential projects for rent. Tests: DB-CON-projects-residential-rent, DB-FN-public-project-rent.
-- Fictional data only.
begin;
select plan(12);

insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'builder1@example.test', 'Kadal Homes');

-- DB-CON-projects-residential-rent
select lives_ok(
  $$insert into public.projects (
      slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type,
      security_deposit, maintenance_per_month, moderation, published, moderated_at
    ) values (
      'kadal-rentals', 'Kadal Rentals', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential',
      'apartment', 'rent', 28000, 'rent_per_month', 150000, 2500, 'approved', true, now()
    )$$,
  'a residential apartment for rent, per month, with a deposit and maintenance is accepted'
);
select lives_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type)
    values ('kadal-sale', 'Kadal Sale', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 'sale', 7500000, 'basic')$$,
  'a residential project may still say sale'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type)
    values ('rent-per-sqft', 'Rent Per Sqft', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 'rent', 30, 'rent_per_sqft_month')$$,
  '23514', null, 'a residential project for rent is priced per month only'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type)
    values ('rent-sale-price', 'Rent Sale Price', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 'rent', 7500000, 'basic')$$,
  '23514', null, 'a residential project for rent cannot carry a sale price type'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, price, price_type, security_deposit)
    values ('sale-deposit', 'Sale Deposit', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 7500000, 'basic', 100000)$$,
  '23514', null, 'a project for sale has no security deposit'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type, maintenance_per_month)
    values ('sale-maintenance', 'Sale Maintenance', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 'sale', 7500000, 'basic', 3000)$$,
  '23514', null, 'a project for sale has no maintenance per month'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type, security_deposit)
    values ('zero-deposit', 'Zero Deposit', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 'rent', 28000, 'rent_per_month', 0)$$,
  '23514', null, 'a security deposit is more than zero'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type, offer_type, price, price_type, maintenance_per_month)
    values ('negative-maintenance', 'Negative Maintenance', '00000000-0000-4000-b000-000000000001', 'Adyar', 'residential', 'apartment', 'rent', 28000, 'rent_per_month', -5)$$,
  '23514', null, 'maintenance per month is more than zero'
);
select throws_ok(
  $$insert into public.projects (slug, name, builder_id, locality, project_type, property_type)
    values ('commercial-blank', 'Commercial Blank', '00000000-0000-4000-b000-000000000001', 'Adyar', 'commercial', 'office')$$,
  '23514', null, 'a commercial project still says sale or rent'
);

-- DB-FN-public-project-rent: the page's read carries the two amounts, and a visitor may read the columns.
select is(
  (select public.public_project('kadal-rentals') -> 'project' ->> 'security_deposit')
    || '/' || (select public.public_project('kadal-rentals') -> 'project' ->> 'maintenance_per_month'),
  '150000/2500',
  'public_project gives the security deposit and the maintenance per month'
);
set local role authenticated;
select lives_ok(
  $select security_deposit, maintenance_per_month from public.projects$,
  'a signed-in visitor can read the security deposit and the maintenance per month'
);
reset role;
set local role anon;
select throws_ok(
  $select security_deposit, maintenance_per_month from public.projects$,
  '42501', null, 'a visitor who is not signed in cannot read them (the login wall, ADR-171)'
);
reset role;

select * from finish();
rollback;
