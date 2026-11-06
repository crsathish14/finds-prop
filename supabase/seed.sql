-- Fictional development data (S3-T13). Loaded by `supabase db reset` on the local stack and in CI. The
-- hosted dev project gets it only when the owner pastes this file into the dashboard's SQL editor
-- (docs/runbooks/dev-seed.md); db-deploy applies migrations only (ADR-034). It can be loaded once: a second
-- load stops at the first statement. `supabase/seed-remove.sql` takes it out again. Never real people, phone numbers,
-- addresses or prices: names, emails (`.example`), phone numbers (a 9000 range) and prices are
-- invented, and the listings describe nothing that exists.
-- Deterministic: no random(), every id comes from the row number, so two resets give the same data
-- (dates are relative to the reset). It runs as `postgres`, which the guard triggers treat as the
-- system, so rows can be written in any status.
-- What is here: 8 customers, 6 builders (one inactive, one agent), 60 listings across ten cities,
-- 12 projects with units and 12 months of price trends, a site-visit form for one project, and two site
-- settings. The default contact form is not here: the migration 20261106140000 stores it. Photos are not here: listing_media needs files in Storage, which scripts/seed-dev.mjs adds.
-- The database tests (supabase/tests) assume empty tables and run before this file is loaded; the seed
-- has its own tests in supabase/seed-tests.

-- Loading it twice would fail halfway on duplicate ids, so say so before anything is written.
do $$
begin
  if exists (select 1 from auth.users where id::text like '5eed0000-%') then
    raise exception 'The fictional seed is already loaded in this database. Run supabase/seed-remove.sql first to load it again.'
      using errcode = 'P0001';
  end if;
end
$$;

-- Customers: phone-only accounts, the way real customers sign in. The identity trigger creates each
-- profile and its customer role.
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data)
select
  ('5eed0000-0000-4000-8000-' || lpad(person.n::text, 12, '0'))::uuid,
  '9190001000' || lpad(person.n::text, 2, '0'),
  now(),
  jsonb_build_object(
    'full_name',
    (array[
      'Anitha Raman', 'Karthik Subramanian', 'Meena Krishnan', 'Vignesh Pandian',
      'Divya Natarajan', 'Suresh Balaji', 'Lakshmi Narayanan', 'Arun Prakash'
    ])[person.n]
  )
from generate_series(1, 8) as person (n);

-- Builders and agents. None has signed in (no user yet), so they show as invited.
insert into public.builders
  (id, user_id, email, name, contact_person, phone, website, description, active, invited_at, kind)
values
  ('5eed0000-0000-4000-8001-000000000001', null, 'sales@kadalhomes.example', 'Kadal Homes', 'Ravi Kumar', '+919000200001', 'https://kadalhomes.example', 'Apartments and villas in Chennai. A fictional builder for development.', true, now() - interval '60 days', 'builder'),
  ('5eed0000-0000-4000-8001-000000000002', null, 'office@marinaconstructions.example', 'Marina Constructions', 'Priya Shankar', '+919000200002', 'https://marinaconstructions.example', 'Residential and commercial towers. A fictional builder for development.', true, now() - interval '55 days', 'builder'),
  ('5eed0000-0000-4000-8001-000000000003', null, 'hello@cauverydevelopers.example', 'Cauvery Developers', 'Mohan Das', '+919000200003', 'https://cauverydevelopers.example', 'Plotted layouts and apartments in Tiruchirappalli. A fictional builder for development.', true, now() - interval '50 days', 'builder'),
  ('5eed0000-0000-4000-8001-000000000004', null, 'projects@nilgirirealty.example', 'Nilgiri Realty', 'Kavitha Rao', '+919000200004', 'https://nilgirirealty.example', 'Villas and apartments in Coimbatore. A fictional builder for development.', true, now() - interval '45 days', 'builder'),
  ('5eed0000-0000-4000-8001-000000000005', null, 'contact@vaigaihabitats.example', 'Vaigai Habitats', 'Senthil Murugan', '+919000200005', 'https://vaigaihabitats.example', 'A deactivated builder, for testing what an inactive account can reach.', false, now() - interval '40 days', 'builder'),
  ('5eed0000-0000-4000-8001-000000000006', null, 'agents@meenakshiproperty.example', 'Meenakshi Property Services', 'Gayathri Devi', '+919000200006', 'https://meenakshiproperty.example', 'An agent working in Madurai, with the same portal as a builder. Fictional.', true, now() - interval '35 days', 'agent');

-- Projects: nine live (two featured), one approved but unpublished, one waiting for review, one
-- rejected. The last two belong to the inactive builder.
insert into public.projects (
  id, slug, name, builder_id, project_type, property_type, project_status, price_min, price_max,
  bhk_options, land_area_acres, total_units, possession_date, contact_phone, locality, address,
  latitude, longitude, advantages, nearby, rera_applicable, rera_number, description, specifications,
  amenities, moderation, published, featured, rejection_reason, moderated_at
)
select
  ('5eed0000-0000-4000-8002-' || lpad(spec.n::text, 12, '0'))::uuid,
  spec.slug,
  spec.name,
  ('5eed0000-0000-4000-8001-' || lpad(spec.builder_n::text, 12, '0'))::uuid,
  spec.project_type,
  spec.property_type,
  spec.project_status,
  spec.price_min,
  spec.price_max,
  spec.bhk_options::smallint[],
  spec.acres,
  spec.total_units,
  (date_trunc('month', current_date) + make_interval(months => spec.possession_months))::date,
  '+9190003000' || lpad(spec.n::text, 2, '0'),
  spec.locality,
  spec.locality || ', ' || spec.city || ', Tamil Nadu',
  spec.latitude,
  spec.longitude,
  array['Close to schools', 'Good road access', 'Water supply assured'],
  array['Bus stop 500 m', 'Hospital 2 km', 'Market 1 km'],
  spec.rera_number is not null,
  spec.rera_number,
  spec.name || ' is a fictional project in ' || spec.locality || ', ' || spec.city || ', made up for development.',
  'Specifications are placeholders for development.',
  array['Parking', 'Security', 'Power backup', 'Play area'],
  spec.moderation,
  spec.published,
  spec.featured,
  spec.rejection_reason,
  case when spec.moderation in ('approved', 'rejected') then now() - interval '2 days' end
from (
  values
    (1, 'kadal-heights-adyar', 'Kadal Heights', 1, 'residential', 'apartment', 'ready_to_move', 9500000, 21000000, '{2,3,4}', 2.4, 180, -6, 'Adyar', 'Chennai', 13.0067, 80.2573, 'approved', true, true, null, 'TN/01/Building/0001/2026'),
    (2, 'kadal-greens-navalur', 'Kadal Greens', 1, 'residential', 'villa', 'under_construction', 11000000, 18500000, '{3,4}', 6.0, 64, 14, 'Navalur', 'Chennai', 12.8458, 80.2265, 'approved', true, false, null, 'TN/01/Building/0002/2026'),
    (3, 'marina-bay-residences', 'Marina Bay Residences', 2, 'residential', 'apartment', 'new_launch', 7200000, 14800000, '{1,2,3}', 3.1, 240, 24, 'Perungudi', 'Chennai', 12.9650, 80.2461, 'approved', true, false, null, 'TN/01/Building/0003/2026'),
    (4, 'marina-trade-centre', 'Marina Trade Centre', 2, 'commercial', null, 'under_construction', 6500000, 32000000, '{}', 1.8, 90, 10, 'Anna Nagar', 'Chennai', 13.0850, 80.2101, 'approved', true, false, null, null),
    (5, 'cauvery-meadows', 'Cauvery Meadows', 3, 'plotted_layout', null, 'new_launch', 1800000, 5200000, '{}', 12.5, 150, 18, 'Srirangam', 'Tiruchirappalli', 10.8630, 78.6900, 'approved', true, false, null, 'TN/02/Layout/0004/2026'),
    (6, 'cauvery-riverside', 'Cauvery Riverside', 3, 'residential', 'apartment', 'under_construction', 4200000, 8900000, '{2,3}', 2.2, 120, 12, 'Thillai Nagar', 'Tiruchirappalli', 10.8210, 78.6860, 'approved', true, false, null, null),
    (7, 'nilgiri-orchard-villas', 'Nilgiri Orchard Villas', 4, 'residential', 'villa', 'ready_to_move', 8800000, 15400000, '{3,4,5}', 4.7, 48, -3, 'Saravanampatti', 'Coimbatore', 11.0770, 76.9970, 'approved', true, true, null, 'TN/03/Building/0005/2026'),
    (8, 'nilgiri-skyline', 'Nilgiri Skyline', 4, 'residential', 'apartment', 'under_construction', 5400000, 11200000, '{2,3}', 2.9, 210, 20, 'RS Puram', 'Coimbatore', 11.0070, 76.9490, 'approved', true, false, null, null),
    (9, 'meenakshi-gardens', 'Meenakshi Gardens', 6, 'plotted_layout', null, 'ready_to_move', 1500000, 3800000, '{}', 8.4, 110, -2, 'KK Nagar', 'Madurai', 9.9470, 78.1480, 'approved', true, false, null, null),
    (10, 'meenakshi-towers', 'Meenakshi Towers', 6, 'residential', 'apartment', 'new_launch', 4800000, 9600000, '{2,3}', 1.6, 96, 26, 'Tallakulam', 'Madurai', 9.9390, 78.1350, 'approved', false, false, null, null),
    (11, 'vaigai-residency', 'Vaigai Residency', 5, 'residential', 'apartment', 'under_construction', 4100000, 7800000, '{1,2,3}', 2.0, 130, 16, 'Palayamkottai', 'Tirunelveli', 8.7260, 77.7340, 'pending', false, false, null, null),
    (12, 'vaigai-enclave', 'Vaigai Enclave', 5, 'residential', 'villa', 'new_launch', 6300000, 9900000, '{3,4}', 3.5, 40, 30, 'Katpadi', 'Vellore', 12.9710, 79.1450, 'rejected', false, false, 'Brochure and approvals are missing. Please add them and submit again.', null)
) as spec (
  n, slug, name, builder_n, project_type, property_type, project_status, price_min, price_max,
  bhk_options, acres, total_units, possession_months, locality, city, latitude, longitude,
  moderation, published, featured, rejection_reason, rera_number
);

-- Units: six to ten per project; plotted layouts get plots.
insert into public.project_units
  (project_id, unit_number, floor_number, bhk, area_sqft, facing, price, available_from, status)
select
  project.id,
  case when project.project_type = 'plotted_layout'
    then 'P-' || lpad(unit.k::text, 2, '0')
    else 'U-' || lpad(unit.k::text, 3, '0')
  end,
  case when project.project_type = 'residential' and project.property_type = 'apartment'
    then (1 + (unit.k - 1) % 12)::smallint
  end,
  case when cardinality(project.bhk_options) > 0
    then project.bhk_options[1 + (unit.k - 1) % cardinality(project.bhk_options)]
  end,
  (case
    when project.project_type = 'plotted_layout' then 1200 + (unit.k % 6) * 300
    when project.project_type = 'commercial' then 600 + (unit.k % 7) * 150
    when project.property_type = 'villa'
      then 1800 + project.bhk_options[1 + (unit.k - 1) % cardinality(project.bhk_options)] * 350
    else 450 + project.bhk_options[1 + (unit.k - 1) % cardinality(project.bhk_options)] * 320
  end)::numeric(10, 2),
  (array['East', 'West', 'North', 'South', 'North-East', 'South-East'])[1 + (unit.k - 1) % 6],
  (round(
    (project.price_min
      + (project.price_max - project.price_min)
        * ((unit.k - 1)::numeric / greatest(unit.total - 1, 1))) / 10000
  ) * 10000)::bigint,
  current_date + unit.k * 20,
  case when unit.k % 5 = 0 then 'sold' when unit.k % 7 = 0 then 'hold' else 'available' end
from public.projects as project
cross join lateral (
  select series.k, 6 + (right(project.id::text, 2)::int % 5) as total
  from generate_series(1, 6 + (right(project.id::text, 2)::int % 5)) as series (k)
) as unit
where project.id::text like '5eed0000-0000-4000-8002-%';

-- Price per square foot by month, twelve months back from this month, rising slowly.
insert into public.project_price_trends (project_id, month, price_per_sqft)
select
  project.id,
  (date_trunc('month', current_date) - make_interval(months => back.m))::date,
  3800 + (right(project.id::text, 2)::int) * 310 + (11 - back.m) * 40
from public.projects as project
cross join generate_series(0, 11) as back (m)
where project.id::text like '5eed0000-0000-4000-8002-%';

-- Listings: sixty across ten cities, built in named steps. Rows 3, 6, 9 and so on are rentals (the
-- price is per month). The status follows the row number so that every state has examples: of every
-- twenty rows, thirteen plus one are approved, two pending, one rejected, two sold or rented, one draft.
with
  alphabet as (
    -- The same letters the short id trigger uses, so the ids pass the same check.
    select 'abcdefghjkmnpqrstuvwxyz23456789'::text as letters
  ),
  locality (slot, city, name, pincode, latitude, longitude) as (
    values
      (1, 'Chennai', 'Adyar', '600020', 13.0067, 80.2573),
      (2, 'Chennai', 'Velachery', '600042', 12.9815, 80.2180),
      (3, 'Chennai', 'Anna Nagar', '600040', 13.0850, 80.2101),
      (4, 'Chennai', 'Navalur', '600130', 12.8458, 80.2265),
      (5, 'Chennai', 'Tambaram', '600045', 12.9249, 80.1000),
      (6, 'Chennai', 'Porur', '600116', 13.0382, 80.1565),
      (7, 'Chennai', 'Perungudi', '600096', 12.9650, 80.2461),
      (8, 'Coimbatore', 'RS Puram', '641002', 11.0070, 76.9490),
      (9, 'Coimbatore', 'Saravanampatti', '641035', 11.0770, 76.9970),
      (10, 'Coimbatore', 'Peelamedu', '641004', 11.0270, 77.0290),
      (11, 'Madurai', 'KK Nagar', '625020', 9.9470, 78.1480),
      (12, 'Madurai', 'Tallakulam', '625002', 9.9390, 78.1350),
      (13, 'Tiruchirappalli', 'Srirangam', '620006', 10.8630, 78.6900),
      (14, 'Tiruchirappalli', 'Thillai Nagar', '620018', 10.8210, 78.6860),
      (15, 'Salem', 'Fairlands', '636016', 11.6690, 78.1400),
      (16, 'Tirunelveli', 'Palayamkottai', '627002', 8.7260, 77.7340),
      (17, 'Erode', 'Perundurai Road', '638011', 11.3410, 77.7170),
      (18, 'Vellore', 'Katpadi', '632007', 12.9710, 79.1450),
      (19, 'Hosur', 'Mathigiri', '635110', 12.7500, 77.8000),
      (20, 'Thanjavur', 'Medical College Road', '613004', 10.7600, 79.1390)
  ),
  base as (
    -- One row per listing: where it is, whether it is for sale or rent, and what kind of property.
    -- A plot is never offered for rent (it becomes an apartment).
    select
      series.n,
      locality.city,
      locality.name as locality_name,
      locality.pincode,
      locality.latitude,
      locality.longitude,
      case when series.n % 3 = 0 then 'rent' else 'sale' end as listing_type,
      case
        when series.n % 3 = 0
          and (array['apartment', 'apartment', 'villa', 'house', 'plot', 'commercial', 'apartment', 'house'])[1 + (series.n - 1) % 8] = 'plot'
          then 'apartment'
        else (array['apartment', 'apartment', 'villa', 'house', 'plot', 'commercial', 'apartment', 'house'])[1 + (series.n - 1) % 8]
      end as property_type
    from generate_series(1, 60) as series (n)
    join locality on locality.slot = 1 + (series.n - 1) % 20
  ),
  rooms as (
    -- Plots and commercial space have no bedrooms (the table forbids it).
    select
      base.*,
      (case base.property_type
        when 'apartment' then 1 + base.n % 4
        when 'villa' then 3 + base.n % 3
        when 'house' then 2 + base.n % 3
      end)::smallint as bhk
    from base
  ),
  described as (
    select
      rooms.*,
      (array['Spacious', 'Well-kept', 'Bright', 'Modern'])[1 + rooms.n % 4]
        || ' ' || case when rooms.bhk is null then '' else rooms.bhk::text || ' BHK ' end
        || rooms.property_type || ' in ' || rooms.locality_name as title,
      (case rooms.property_type
        when 'apartment' then 450 + rooms.bhk * 320 + (rooms.n % 5) * 25
        when 'villa' then 1800 + rooms.bhk * 350
        when 'house' then 900 + rooms.bhk * 300
        when 'plot' then 1200 + (rooms.n % 6) * 300
        else 600 + (rooms.n % 7) * 200
      end)::numeric(10, 2) as area,
      (case rooms.city
        when 'Chennai' then 8500
        when 'Coimbatore' then 6200
        when 'Madurai' then 5200
        when 'Tiruchirappalli' then 4800
        when 'Hosur' then 5600
        when 'Salem' then 4300
        when 'Vellore' then 4200
        when 'Erode' then 4100
        when 'Tirunelveli' then 3900
        else 3700
      end + (rooms.n % 7) * 150) as price_per_sqft,
      case rooms.n % 20
        when 13 then 'pending'
        when 14 then 'pending'
        when 15 then 'rejected'
        when 16 then case rooms.listing_type when 'sale' then 'sold' else 'rented' end
        when 17 then case rooms.listing_type when 'sale' then 'sold' else 'rented' end
        when 18 then 'draft'
        else 'approved'
      end as status
    from rooms
  ),
  priced as (
    -- A sale price rounds to ten thousand rupees; a monthly rent to a hundred.
    select
      described.*,
      case described.listing_type
        when 'sale'
          then (round((described.area * described.price_per_sqft) / 10000.0) * 10000)::bigint
        else (round((described.area * described.price_per_sqft / 350.0) / 100.0) * 100)::bigint
      end as price
    from described
  )
insert into public.properties (
  short_id, slug, owner_id, listing_type, property_type, title, description, bhk, bathrooms, area_sqft,
  price, furnishing, amenities, available_from, address, locality, city, state, pincode, location,
  status, featured, rejection_reason, moderated_at, submitted_at, published_at, closed_at, created_at
)
select
  'seed'
    || substr(alphabet.letters, 1 + (priced.n / 29791) % 31, 1)
    || substr(alphabet.letters, 1 + (priced.n / 961) % 31, 1)
    || substr(alphabet.letters, 1 + (priced.n / 31) % 31, 1)
    || substr(alphabet.letters, 1 + priced.n % 31, 1),
  public.build_property_slug(priced.title, priced.locality_name),
  ('5eed0000-0000-4000-8000-' || lpad(((priced.n - 1) % 8 + 1)::text, 12, '0'))::uuid,
  priced.listing_type,
  priced.property_type,
  priced.title,
  'A fictional ' || priced.property_type || ' in ' || priced.locality_name || ', ' || priced.city
    || '. Close to schools, shops and public transport. Made up for development.',
  priced.bhk,
  (case priced.property_type
    when 'plot' then null
    when 'commercial' then 2
    else least(priced.bhk, 4)
  end)::smallint,
  priced.area,
  priced.price,
  case when priced.property_type in ('plot', 'commercial') then null
    else (array['unfurnished', 'semi', 'full'])[1 + priced.n % 3]
  end,
  (array['Parking', 'Lift', 'Power backup', 'Security', 'Gym', 'Garden', 'Play area', 'Water storage', 'CCTV', 'Clubhouse'])[(priced.n % 5) + 1 : (priced.n % 5) + 4],
  current_date + priced.n % 30,
  (priced.n + 10)::text || ', Fourth Cross Street, ' || priced.locality_name,
  priced.locality_name,
  priced.city,
  'Tamil Nadu',
  priced.pincode,
  extensions.st_setsrid(
    extensions.st_makepoint(
      (priced.longitude + ((priced.n % 7) - 3) * 0.0011)::float8,
      (priced.latitude + ((priced.n % 5) - 2) * 0.0009)::float8
    ),
    4326
  )::extensions.geography,
  priced.status,
  priced.status = 'approved' and priced.n % 9 = 0,
  case when priced.status = 'rejected'
    then 'Photos are missing. Please add at least three clear photos and submit again.'
  end,
  case when priced.status in ('approved', 'rejected', 'sold', 'rented')
    then now() - make_interval(hours => 20 + priced.n * 5)
  end,
  case when priced.status <> 'draft' then now() - make_interval(hours => 24 + priced.n * 5) end,
  case when priced.status in ('approved', 'sold', 'rented')
    then now() - make_interval(hours => 18 + priced.n * 5)
  end,
  case when priced.status in ('sold', 'rented') then now() - make_interval(hours => 10 + priced.n * 5) end,
  now() - make_interval(hours => 24 + priced.n * 5)
from priced
cross join alphabet;

-- The default contact form (placement `contact`). The field type names are the ones the form builder
-- will validate (S7-T08); change them here if that vocabulary differs.
-- A form made for one project: Kadal Heights (project 1) asks for a site visit, so that page shows this form
-- (a signed-in visitor with a verified phone sees it in the enquiry card) and the other projects show the
-- built-in card (BR-49, ADR-056). The default contact form is stored by a migration, not here.
insert into public.forms (id, name, slug, kind, placement, project_id, button_text, success_message, fields, active)
values (
  '5eed0000-0000-4000-8003-000000000001',
  'Kadal Heights site visit',
  'kadal-heights-visit',
  'site_visit',
  'project_specific',
  '5eed0000-0000-4000-8002-000000000001',
  'Book a visit',
  'Thank you. The Kadal Heights team will call you to confirm your visit.',
  '[
    {"label": "Your name", "key": "name", "type": "text", "placeholder": "Your full name", "required": true},
    {"label": "Mobile", "key": "mobile", "type": "text", "required": true},
    {"label": "Preferred visit day", "key": "visit_date", "type": "date", "required": true},
    {"label": "Anything we should know?", "key": "message", "type": "textarea", "max": 300, "required": false}
  ]'::jsonb,
  true
);

-- Content settings with data in them. The other keys (header, footer, hero) use the defaults in code.
-- There is no sponsor table yet, so no sample sponsors are seeded.
insert into public.site_settings (key, value)
values
  (
    'homepage',
    jsonb_build_object(
      'showFeatured', true,
      'showProjectTypes', true,
      'showDiscovery', true,
      'showWhyUs', true,
      'showCta', true,
      'localities', jsonb_build_array(
        jsonb_build_object('label', 'Adyar, Chennai', 'lat', 13.0067, 'lng', 80.2573, 'radiusKm', 4),
        jsonb_build_object('label', 'Velachery, Chennai', 'lat', 12.9815, 'lng', 80.2180, 'radiusKm', 4),
        jsonb_build_object('label', 'Navalur, Chennai', 'lat', 12.8458, 'lng', 80.2265, 'radiusKm', 6),
        jsonb_build_object('label', 'RS Puram, Coimbatore', 'lat', 11.0070, 'lng', 76.9490, 'radiusKm', 4),
        jsonb_build_object('label', 'Saravanampatti, Coimbatore', 'lat', 11.0770, 'lng', 76.9970, 'radiusKm', 5),
        jsonb_build_object('label', 'KK Nagar, Madurai', 'lat', 9.9470, 'lng', 78.1480, 'radiusKm', 4),
        jsonb_build_object('label', 'Srirangam, Tiruchirappalli', 'lat', 10.8630, 'lng', 78.6900, 'radiusKm', 5),
        jsonb_build_object('label', 'Fairlands, Salem', 'lat', 11.6690, 'lng', 78.1400, 'radiusKm', 5)
      )
    )
  ),
  (
    'region',
    jsonb_build_object(
      'name', 'Tamil Nadu',
      'copyShort', 'Tamil Nadu',
      'bounds', jsonb_build_object('south', 8.0, 'west', 76.2, 'north', 13.6, 'east', 80.4)
    )
  );
