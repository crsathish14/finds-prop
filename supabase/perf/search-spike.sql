-- S4-SPK-01: does search_properties() use its indexes and answer fast on about 10,000 listings?
-- Plan 06 section 9.2: "plans use the partial indexes at ~10 k seeded rows; p95 < 100 ms".
--
-- Run by the CI db job, as the database superuser inside the local stack's container:
--   docker exec -i supabase_db_findsprop psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < supabase/perf/search-spike.sql
-- Variables: -v p95_limit=100 (the gate, milliseconds) and -v runs=200 (calls timed per search).
-- It only ever runs against the throwaway local stack. It is not part of the normal seed, it makes
-- fictional data only (R-DB-11), it removes what it made before it starts, and it can run again.
--
-- It prints one line per search: the time of 200 real calls (p50, p95, max), the indexes the plan
-- chooses, whether that plan reads the whole table, whether the named index can serve the search, and
-- a verdict. It fails (a non-zero exit) when a search is slower than the gate, or when a gated search
-- cannot use its named index (no search is gated that way at present, see below). Four things it
-- deliberately does not ask:
--   * That the planner picks the named index by itself. At about 10,000 rows it may rightly prefer
--     another plan, so the check is that the index CAN serve the search: the plan is asked again with
--     full scans off, then with full scans and plain index scans off (leaving the bitmap scans a place
--     or keyword index gives), then with full scans and bitmap scans off (leaving the ordered index
--     scan a sort index gives). The natural plan is still printed.
--   * That a search with no filter avoids reading the whole table. total_count is the number of every
--     matching listing, so those searches must read them all; this grows with the table.
--   * That the sort indexes (newest, price) can serve a search with no filter. They cannot:
--     total_count is a window count, so the function reads and sorts every match before it returns the
--     first page, and no plan, however forced, takes the order from an index (S4-SPK-01, ADR-012). Those
--     three checks are printed, not gated; the p95 gate is what catches the cost when the table grows.
--     The newest and price indexes do serve searches that have a filter (the radius searches choose
--     them). The area index (the "Largest" sort) could serve neither kind of search and was dropped
--     (migration 20261103130000); the "Largest" sort is still timed, with and without a filter.
--   * That a visitor can use the place and keyword indexes: a visitor cannot (S4-SPK-01, ADR-012). The
--     search runs under Row Level Security, which lets a visitor's filter into an index only if its
--     operator is leakproof, and the PostGIS and text-search operators are not. The superuser, which
--     Row Level Security does not apply to, does use them. These two checks are printed, not gated;
--     the p95 gate is what catches the cost when the table grows.
-- The plan is taken from the statement inside search_properties() itself, so it cannot drift.
-- The last table says, for every search with a named index, whether the index is in the plan as a
-- visitor and as the superuser; the plans themselves are printed for a search whose verdict failed.

\set ON_ERROR_STOP on
\if :{?p95_limit}
\else
  \set p95_limit 100
\endif
\if :{?runs}
\else
  \set runs 200
\endif
select set_config('spike.p95_limit', :'p95_limit', false) as p95_limit_ms,
       set_config('spike.runs', :'runs', false) as runs_per_search \gset

-- 1. Remove an earlier run. The rows are marked by their owners' ids (a fixed made-up prefix).
set session_replication_role = replica;
delete from public.listing_media
  where listing_id in (select id from public.properties where owner_id::text like '00000000-0000-4000-a000-%');
delete from public.properties where owner_id::text like '00000000-0000-4000-a000-%';
reset session_replication_role;
delete from auth.users where id::text like '00000000-0000-4000-a000-%';

-- 2. Twenty-five made-up owners.
insert into auth.users (id, phone, phone_confirmed_at)
select ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
       '9192000' || lpad(n::text, 5, '0'),
       now()
from generate_series(1, 25) as n;

-- 3. Ten thousand listings across eight Tamil Nadu cities, in the mix a real site would have: most
-- approved, some pending, draft, sold or rented. Triggers are switched off for the load only (the
-- generated columns still fill in), so the short id and slug are made here.
select setseed(0.42);
set session_replication_role = replica;

with
  city (idx, name, lat, lng, weight, places) as (values
    (1, 'Chennai', 13.0827, 80.2707, 45, array['Adyar', 'Velachery', 'Anna Nagar', 'T Nagar', 'Tambaram', 'Porur', 'Mylapore', 'Guindy']),
    (2, 'Coimbatore', 11.0168, 76.9558, 15, array['Gandhipuram', 'RS Puram', 'Peelamedu', 'Saibaba Colony', 'Singanallur', 'Race Course', 'Vadavalli', 'Ganapathy']),
    (3, 'Madurai', 9.9252, 78.1198, 12, array['Anna Nagar', 'KK Nagar', 'Thirunagar', 'Goripalayam', 'Vilangudi', 'Tallakulam', 'Simmakkal', 'Bypass Road']),
    (4, 'Tiruchirappalli', 10.7905, 78.7047, 10, array['Srirangam', 'Thillai Nagar', 'Cantonment', 'KK Nagar', 'Woraiyur', 'Ariyamangalam', 'Karumandapam', 'Puthur']),
    (5, 'Salem', 11.6643, 78.1460, 8, array['Fairlands', 'Hasthampatti', 'Shevapet', 'Alagapuram', 'Ammapet', 'Kitchipalayam', 'Suramangalam', 'Gugai']),
    (6, 'Tirunelveli', 8.7139, 77.7567, 5, array['Palayamkottai', 'Vannarpettai', 'Melapalayam', 'Thachanallur', 'Junction', 'Perumalpuram', 'Maharaja Nagar', 'Pettai']),
    (7, 'Erode', 11.3410, 77.7172, 3, array['Perundurai Road', 'Surampatti', 'Moolapalayam', 'Karungalpalayam', 'Veerappanchatram', 'Chithode', 'Bhavani Road', 'Brough Road']),
    (8, 'Vellore', 12.9165, 79.1325, 2, array['Katpadi', 'Sathuvachari', 'Gandhi Nagar', 'Bagayam', 'Thorapadi', 'Vasanthapuram', 'Kosapet', 'Sainathapuram'])
  ),
  band as (
    select idx, name, lat, lng, places,
           sum(weight) over (order by idx) - weight as from_pct,
           sum(weight) over (order by idx) as to_pct
    from city
  ),
  draw as (
    select n,
           random() * 100 as pick,
           random() as kind_roll, random() as sale_roll, random() as size_roll, random() as price_roll,
           random() as word_roll, random() as place_roll, random() as lat_roll, random() as lng_roll,
           random() as status_roll, random() as feature_roll, random() as age_roll, random() as zip_roll
    from generate_series(1, 10000) as n
  ),
  planned as (
    select draw.*, band.name as town, band.lat, band.lng,
           band.places[1 + floor(draw.place_roll * 8)::int] as place,
           case
             when draw.kind_roll < 0.50 then 'apartment'
             when draw.kind_roll < 0.65 then 'villa'
             when draw.kind_roll < 0.85 then 'house'
             when draw.kind_roll < 0.93 then 'plot'
             else 'commercial'
           end as kind
    from draw
    join band on draw.pick >= band.from_pct and draw.pick < band.to_pct
  ),
  sized as (
    select planned.*,
           case when kind = 'plot' or sale_roll >= 0.30 then 'sale' else 'rent' end as listing_kind,
           case kind
             when 'apartment' then 450 + size_roll * 1500
             when 'villa' then 1800 + size_roll * 3000
             when 'house' then 900 + size_roll * 2500
             when 'plot' then 600 + size_roll * 5000
             else 400 + size_roll * 3000
           end::numeric(10, 2) as area,
           case kind
             when 'apartment' then 1 + floor(price_roll * 4)::int
             when 'villa' then 3 + floor(price_roll * 3)::int
             when 'house' then 2 + floor(price_roll * 3)::int
             else null
           end as bedrooms,
           case
             when status_roll < 0.85 then 'approved'
             when status_roll < 0.90 then 'pending'
             when status_roll < 0.94 then 'draft'
             when status_roll < 0.97 then 'sold'
             else 'rented'
           end as listing_status
    from planned
  )
insert into public.properties (
  id, short_id, slug, owner_id, status, featured, listing_type, property_type, title, description,
  bhk, bathrooms, area_sqft, price, locality, city, state, pincode, address, location,
  submitted_at, published_at
)
select
  gen_random_uuid(),
  translate(lpad(to_hex(n + 1048576), 8, '0'), '01', 'xy'),
  'spike-' || n,
  ('00000000-0000-4000-a000-' || lpad((1 + (n % 25))::text, 12, '0'))::uuid,
  listing_status,
  listing_status = 'approved' and feature_roll < 0.03,
  listing_kind,
  kind,
  (array['Bright', 'Spacious', 'Sunny', 'Modern', 'Cosy', 'Elegant'])[1 + floor(word_roll * 6)::int]
    || ' ' || kind || ' in ' || place,
  'A fictional listing for the search spike.',
  bedrooms,
  case when bedrooms is null then null else greatest(1, bedrooms - 1) end,
  area,
  case listing_kind
    when 'sale' then round((area * (2500 + price_roll * 9500))::numeric, -3)
    else round((8000 + area * (8 + price_roll * 25))::numeric, -2)
  end::bigint,
  place,
  town,
  'Tamil Nadu',
  '6' || lpad(floor(zip_roll * 100000)::int::text, 5, '0'),
  'Plot ' || n || ', Spike Street',
  extensions.st_setsrid(
    extensions.st_makepoint(lng + (lng_roll - 0.5) * 0.24, lat + (lat_roll - 0.5) * 0.24), 4326
  )::extensions.geography,
  now() - make_interval(days => 30),
  case when listing_status in ('approved', 'sold', 'rented')
    then now() - make_interval(secs => age_roll * 730 * 86400)
  end
from sized;

-- Six in ten approved listings carry a cover photo, as on a real site.
insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, position, is_cover, alt_text)
select id, 'spike/' || id || '/cover.webp', 'image/webp', 50000, 1600, 1200, 0, true, 'Fictional photo'
from public.properties
where owner_id::text like '00000000-0000-4000-a000-%' and status = 'approved' and random() < 0.6;

reset session_replication_role;
analyze public.properties;
analyze public.listing_media;

select count(*) as listings_loaded,
       count(*) filter (where status = 'approved') as approved
from public.properties
where owner_id::text like '00000000-0000-4000-a000-%';

-- 4. The searches. Each row is one search the app will make; expect_index names an index that should be
-- able to serve it (only where one is clearly the right tool); gate_index says whether failing that
-- check fails the run (only searches whose index can serve them are gated; see the header for the rest,
-- and ungated_note for what the result says in place of NOT USABLE).
create temp table spike_shapes (
  id serial primary key,
  label text not null,
  listing_type text, property_type text, bhk integer, min_price bigint, max_price bigint,
  locality text, lat double precision, lng double precision, radius double precision,
  west double precision, south double precision, east double precision, north double precision,
  q text, label_filter text, sort text not null default 'newest', page_size integer not null default 12,
  expect_index text, gate_index boolean not null default true,
  ungated_note text not null default 'not usable by a visitor (not gated, ADR-012)'
);
insert into spike_shapes (label, sort, page_size, expect_index, gate_index, ungated_note) values
  ('newest, no filter', 'newest', 12, 'properties_search_newest', false, 'not usable: total_count reads every match (not gated, ADR-012)'),
  ('price up, no filter', 'price_asc', 12, 'properties_search_price', false, 'not usable: total_count reads every match (not gated, ADR-012)'),
  ('price down, no filter', 'price_desc', 12, 'properties_search_price', false, 'not usable: total_count reads every match (not gated, ADR-012)');
insert into spike_shapes (label, sort, page_size) values
  ('largest, no filter', 'area_desc', 12),
  ('largest page, newest, 120', 'newest', 120);
insert into spike_shapes (label, listing_type) values ('buy, newest', 'sale');
insert into spike_shapes (label, listing_type, property_type, bhk, max_price)
  values ('rent apartment 2 bhk under 30000', 'rent', 'apartment', 2, 30000);
insert into spike_shapes (label, listing_type, property_type, sort, page_size)
  values ('buy villa, price up, 24', 'sale', 'villa', 'price_asc', 24);
insert into spike_shapes (label, lat, lng, radius, expect_index, gate_index)
  values ('Chennai within 5 km', 13.0827, 80.2707, 5, 'properties_search_place', false);
insert into spike_shapes (label, lat, lng, radius, sort, page_size)
  values ('Chennai within 25 km, price up, 24', 13.0827, 80.2707, 25, 'price_asc', 24);
insert into spike_shapes (label, lat, lng, radius, expect_index, gate_index)
  values ('Coimbatore within 10 km', 11.0168, 76.9558, 10, 'properties_search_place', false);
insert into spike_shapes (label, west, south, east, north, expect_index, gate_index)
  values ('Chennai map box', 80.15, 12.98, 80.35, 13.15, 'properties_search_place', false);
insert into spike_shapes (label, q, expect_index, gate_index)
  values ('keyword, a rare place (Srirangam)', 'Srirangam', 'properties_search_keyword', false);
insert into spike_shapes (label, q) values ('keyword, a common word (villa)', 'villa');
insert into spike_shapes (label, q, lat, lng, radius)
  values ('keyword and radius', 'Adyar', 13.0827, 80.2707, 10);
insert into spike_shapes (label, locality) values ('locality text (adyar)', 'adyar');
insert into spike_shapes (label, label_filter) values ('label prime', 'prime');
insert into spike_shapes (label, label_filter) values ('label featured', 'featured');
insert into spike_shapes (label, listing_type, property_type, bhk, max_price, lat, lng, radius, sort, page_size)
  values ('buy apartment 3 bhk under 80 lakh, within 10 km, price up, 24', 'sale', 'apartment', 3, 8000000, 13.0827, 80.2707, 10, 'price_asc', 24);
-- The "Largest" sort with a filter. It once named properties_search_area, which could not serve it (or the
-- search with no filter) and was dropped (ADR-012); it stays so the sort is still timed against the gate.
insert into spike_shapes (label, listing_type, property_type, sort, page_size)
  values ('buy apartment, largest, 24', 'sale', 'apartment', 'area_desc', 24);

create temp table spike_results (
  id integer, label text, matches bigint, runs integer, p50_ms numeric, p95_ms numeric, max_ms numeric,
  indexes text, reads_whole_table boolean, index_check text, verdict text
);

-- Where is the named index used? For each search with a named index, the same plan questions are asked
-- as a visitor and as the superuser (which Row Level Security does not apply to). v_ is the visitor, s_
-- the superuser; as_chosen is the plan the planner picks, forced is any of the three forced plans (full
-- scans off; plain index scans off too; bitmap scans off too). The value says whether the index is in it.
create temp table spike_diagnosis (
  id integer, label text, expect_index text,
  v_as_chosen boolean, v_forced boolean, s_as_chosen boolean, s_forced boolean,
  plans text
);

do $$
declare
  shape record;
  source text;
  template text;
  order_clause text;
  stmt text;
  plan json;
  plan_text text;
  sample_ms numeric[];
  started timestamptz;
  matches bigint;
  used_indexes text;
  probe_indexes text;
  whole_table boolean;
  index_check text;
  plan_line record;
  plan_lines text;
  diag_hits boolean[];
  diag_plans text;
  problems text;
  gate numeric := current_setting('spike.p95_limit')::numeric;
  runs integer := current_setting('spike.runs')::integer;
  p50 numeric;
  p95 numeric;
begin
  -- The statement search_properties() builds, taken from the function so the plan is the real one.
  select prosrc into source from pg_proc
  where proname = 'search_properties' and pronamespace = 'public'::regnamespace;
  template := substring(source from '(?s)format\(\$sql\$(.*)\$sql\$, order_by\)');
  if template is null or position('order by %1$s' in template) = 0 then
    raise exception 'The statement inside search_properties() was not found; update this script to match it';
  end if;

  for shape in select * from spike_shapes order by id loop
    stmt := 'select coalesce(max(total_count), 0) from public.search_properties(' || concat_ws(', ',
      case when shape.listing_type is not null then format('p_listing_type => %L', shape.listing_type) end,
      case when shape.property_type is not null then format('p_property_type => %L', shape.property_type) end,
      case when shape.bhk is not null then format('p_bhk => %s', shape.bhk) end,
      case when shape.min_price is not null then format('p_min_price => %s', shape.min_price) end,
      case when shape.max_price is not null then format('p_max_price => %s', shape.max_price) end,
      case when shape.locality is not null then format('p_locality => %L', shape.locality) end,
      case when shape.lat is not null then format('p_lat => %s, p_lng => %s', shape.lat, shape.lng) end,
      case when shape.radius is not null then format('p_radius_km => %s', shape.radius) end,
      case when shape.west is not null then
        format('p_west => %s, p_south => %s, p_east => %s, p_north => %s', shape.west, shape.south, shape.east, shape.north) end,
      case when shape.q is not null then format('p_q => %L', shape.q) end,
      case when shape.label_filter is not null then format('p_label => %L', shape.label_filter) end,
      format('p_sort => %L', shape.sort),
      format('p_limit => %s', shape.page_size)
    ) || ')';

    -- Time and plan as a visitor (anon): Row Level Security and the cover-photo policy are part of the cost.
    execute 'set local role anon';
    execute stmt into matches; -- one call first, to warm the caches
    sample_ms := '{}';
    for i in 1..runs loop
      started := clock_timestamp();
      execute stmt into matches;
      sample_ms := sample_ms || (extract(epoch from clock_timestamp() - started) * 1000)::numeric;
    end loop;
    order_clause := case shape.sort
      when 'newest' then 'found.published_at desc, found.id'
      when 'price_asc' then 'found.price, found.id'
      when 'price_desc' then 'found.price desc, found.id desc'
      else 'found.area_sqft desc nulls last, found.id'
    end;
    -- Probe 0 is the plan the planner chooses. Where the search has a named index that it did not
    -- choose, ask again with full scans off (probe 1); then with the plain index scans off too (probe 2),
    -- which leaves the bitmap scans of a place or keyword index; then with the bitmap scans off instead
    -- (probe 3), which leaves the ordered index scan of a sort index. Without probe 3 the planner picks
    -- a bitmap scan on the status index, and without probe 2 the newest-first index beats the place one.
    used_indexes := null;
    whole_table := null;
    index_check := null;
    for probe in 0..3 loop
      exit when probe > 0 and (shape.expect_index is null or index_check <> 'NOT USABLE');
      if probe >= 1 then
        perform set_config('enable_seqscan', 'off', true);
      end if;
      if probe = 2 then
        perform set_config('enable_indexscan', 'off', true);
        perform set_config('enable_indexonlyscan', 'off', true);
      end if;
      if probe = 3 then
        perform set_config('enable_bitmapscan', 'off', true);
      end if;
      execute 'explain (format json) ' || replace(template, '%1$s', order_clause)
        into plan
        using shape.listing_type, shape.property_type, shape.bhk, shape.min_price, shape.max_price,
          nullif(btrim(shape.locality), ''), (shape.lat is not null), shape.lat, shape.lng,
          coalesce(shape.radius, 5), (shape.west is not null), shape.west, shape.south, shape.east,
          shape.north, nullif(btrim(shape.q), ''), shape.label_filter, shape.page_size;
      perform set_config('enable_seqscan', 'on', true);
      perform set_config('enable_indexscan', 'on', true);
      perform set_config('enable_indexonlyscan', 'on', true);
      perform set_config('enable_bitmapscan', 'on', true);

      plan_text := plan::text;
      select string_agg(distinct hit[1], ', ' order by hit[1]) into probe_indexes
      from regexp_matches(plan_text, '"Index Name": "([^"]+)"', 'g') as hit;
      if probe = 0 then
        used_indexes := probe_indexes;
        whole_table := plan_text ~ '"Node Type": "Seq Scan"[^}]*"Relation Name": "properties"';
        if shape.expect_index is not null then
          index_check := case when position(shape.expect_index in coalesce(probe_indexes, '')) > 0
            then 'chosen' else 'NOT USABLE' end;
        end if;
      elsif position(shape.expect_index in coalesce(probe_indexes, '')) > 0 then
        index_check := case probe when 1 then 'usable, not chosen (full scans off)'
          when 2 then 'usable, not chosen (plain index scans off too)'
          else 'usable, not chosen (bitmap scans off too)' end;
      end if;
    end loop;
    execute 'reset role';

    -- A check that is printed, not gated (see the header): say so in the result instead of failing.
    if index_check = 'NOT USABLE' and not shape.gate_index then
      index_check := shape.ungated_note;
    end if;

    select percentile_cont(0.5) within group (order by ms),
           percentile_cont(0.95) within group (order by ms)
      into p50, p95
    from unnest(sample_ms) as ms;

    problems := '';
    if p95 > gate then
      problems := problems || format(' p95 %s ms is over the %s ms gate;', round(p95, 2), gate);
    end if;
    if index_check = 'NOT USABLE' then
      problems := problems || format(' %s cannot serve this search, even when the planner is forced to use an index;', shape.expect_index);
    end if;

    insert into spike_results
    values (shape.id, shape.label, matches, runs, round(p50, 2), round(p95, 2),
            round((select max(ms) from unnest(sample_ms) as ms), 2), used_indexes, whole_table,
            index_check, case when problems = '' then 'ok' else 'FAIL:' || problems end);

    -- Where is the index used? The four plan questions above (as chosen, then the three forced ones),
    -- asked as a visitor (1) and as the superuser (2), with the plan text kept for the report below.
    if shape.expect_index is not null then
      diag_hits := array[null, null, null, null, null, null, null, null]::boolean[];
      diag_plans := '';
      for who in 1..2 loop
        if who = 1 then
          execute 'set local role anon';
        else
          execute 'reset role';
        end if;
        for probe in 0..3 loop
          if probe >= 1 then
            perform set_config('enable_seqscan', 'off', true);
          end if;
          if probe = 2 then
            perform set_config('enable_indexscan', 'off', true);
            perform set_config('enable_indexonlyscan', 'off', true);
          end if;
          if probe = 3 then
            perform set_config('enable_bitmapscan', 'off', true);
          end if;
          plan_lines := '';
          for plan_line in execute 'explain ' || replace(template, '%1$s', order_clause)
            using shape.listing_type, shape.property_type, shape.bhk, shape.min_price, shape.max_price,
              nullif(btrim(shape.locality), ''), (shape.lat is not null), shape.lat, shape.lng,
              coalesce(shape.radius, 5), (shape.west is not null), shape.west, shape.south, shape.east,
              shape.north, nullif(btrim(shape.q), ''), shape.label_filter, shape.page_size
          loop
            plan_lines := plan_lines || plan_line."QUERY PLAN" || E'\n';
          end loop;
          perform set_config('enable_seqscan', 'on', true);
          perform set_config('enable_indexscan', 'on', true);
          perform set_config('enable_indexonlyscan', 'on', true);
          perform set_config('enable_bitmapscan', 'on', true);
          diag_hits[(who - 1) * 4 + probe + 1] := position(shape.expect_index in plan_lines) > 0;
          diag_plans := diag_plans || format(E'-- as the %s, %s --\n%s',
            case who when 1 then 'visitor' else 'superuser' end,
            case probe when 0 then 'plan as chosen' when 1 then 'full scans off'
              when 2 then 'plain index scans off too' else 'bitmap scans off too' end,
            plan_lines);
        end loop;
      end loop;
      execute 'reset role';
      insert into spike_diagnosis
      values (shape.id, shape.label, shape.expect_index,
              diag_hits[1], diag_hits[2] or diag_hits[3] or diag_hits[4],
              diag_hits[5], diag_hits[6] or diag_hits[7] or diag_hits[8], diag_plans);
    end if;
  end loop;
end
$$;

\echo
\echo 'S4-SPK-01 results (time of one call, in milliseconds, over the runs given):'
select id, label, matches as total_matches, p50_ms, p95_ms, max_ms, indexes, reads_whole_table,
       index_check, verdict
from spike_results order by id;

\echo
\echo 'Is the named index in the plan? v = as a visitor, s = as the superuser (no Row Level Security);'
\echo 'as_chosen = the plan the planner picks, forced = any plan with full scans off and one more scan kind off:'
select id, label, expect_index, v_as_chosen, v_forced, s_as_chosen, s_forced
from spike_diagnosis order by id;

-- The plans, for the first failed search of each named index (nothing is printed when all pass).
do $$
declare
  d record;
begin
  for d in
    select distinct on (g.expect_index) g.id, g.label, g.expect_index, g.plans
    from spike_diagnosis as g
    join spike_results as r on r.id = g.id
    where r.verdict <> 'ok'
    order by g.expect_index, g.id
  loop
    raise notice E'plans for "%" (named index %):\n%', d.label, d.expect_index, d.plans;
  end loop;
end
$$;

do $$
declare
  failed integer;
begin
  select count(*) into failed from spike_results where verdict <> 'ok';
  if failed > 0 then
    raise exception 'S4-SPK-01: % of % searches failed (see the table above)',
      failed, (select count(*) from spike_results);
  end if;
  raise notice 'S4-SPK-01: all % searches passed (p95 under % ms)',
    (select count(*) from spike_results), current_setting('spike.p95_limit');
end
$$;
