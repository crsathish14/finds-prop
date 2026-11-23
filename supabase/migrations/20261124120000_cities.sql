-- Header city selector, part 1 (change request, Plan 2): the cities table and a city filter in search.
-- Rules: BR-90 (only approved listings are searched), BR-91 (the filters), ADR-012 (search).
-- What this adds:
--   1. `city_key(text)`: the spelling-proof form of a city name (lower case, letters and digits only), so
--      "Chennai", "chennai " and "Chennai." are the same city. Immutable, so it can carry an index.
--   2. `public.cities`: one row per city that exists in findsprop (key, name, state). Readable by everyone,
--      written only by the trigger below (no client write grants, no write policies).
--   3. A trigger on `properties`: when a listing is written with a city that is not in the table yet, the
--      city (and ONLY the city, never the locality or the address) is added. The key stops duplicates.
--   4. The table is filled from the cities of the listings that exist now, plus Chennai (the default city).
--   5. `listed_cities()`: the cities that have at least one approved listing, most listings first. The
--      header dropdown shows these, so a misspelt or abandoned draft city never appears in it.
--   6. `search_properties()` gets a last parameter `p_city` (a city key, default null = all cities) that keeps
--      only listings of that city. The function's other columns, checks and grants are unchanged; it is
--      dropped and made again because its argument list changes.
-- Rollback note: nothing stored is lost. To go back, add a new migration that drops the new function and
-- makes the previous one again (20261117130000_search_distance.sql), then drops the trigger, the table and
-- city_key. Listings keep their own `city` text.

create function public.city_key(city text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(city, ''))), '[^[:alnum:]]', '', 'g'), '')
$$;
grant execute on function public.city_key(text) to anon, authenticated, service_role;

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[[:alnum:]]+$' and char_length(key) between 2 and 80),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  state text check (char_length(state) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.cities enable row level security;
revoke all on table public.cities from anon, authenticated;
grant select (key, name, state) on table public.cities to anon, authenticated;
create policy cities_select_all on public.cities for select to anon, authenticated using (true);

-- The display name of a city as the table keeps it: trimmed, single spaces, each word capitalised.
create function public.city_display_name(city text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(initcap(lower(btrim(city))), '\s+', ' ', 'g')
$$;

create function public.add_listing_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.city_key(new.city) is not null then
    insert into public.cities (key, name, state)
    values (public.city_key(new.city), public.city_display_name(new.city), nullif(btrim(new.state), ''))
    on conflict (key) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.add_listing_city() from public, anon, authenticated;
revoke execute on function public.city_display_name(text) from public, anon, authenticated;

create trigger properties_add_city
  after insert or update of city on public.properties
  for each row execute function public.add_listing_city();

-- Fill the table from the listings that exist now, and make sure Chennai (the default) is there.
insert into public.cities (key, name, state)
select distinct on (public.city_key(city)) public.city_key(city), public.city_display_name(city), nullif(btrim(state), '')
from public.properties
where public.city_key(city) is not null and char_length(btrim(city)) between 2 and 80
order by public.city_key(city), published_at desc nulls last
on conflict (key) do nothing;
insert into public.cities (key, name, state) values ('chennai', 'Chennai', 'Tamil Nadu')
on conflict (key) do nothing;

create index properties_city_key_idx on public.properties (public.city_key(city));

create function public.listed_cities()
returns table (key text, name text, listing_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select cities.key, cities.name, count(*) as listing_count
  from public.cities as cities
  join public.properties as listing on public.city_key(listing.city) = cities.key
  where listing.status = 'approved'
  group by cities.key, cities.name
  order by count(*) desc, cities.name
$$;
grant execute on function public.listed_cities() to anon, authenticated, service_role;

drop function public.search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer
);

create function public.search_properties(
  p_listing_type text default null,
  p_property_type text default null,
  p_bhk integer default null,
  p_min_price bigint default null,
  p_max_price bigint default null,
  p_locality text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default 5,
  p_west double precision default null,
  p_south double precision default null,
  p_east double precision default null,
  p_north double precision default null,
  p_q text default null,
  p_label text default null,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_city text default null
)
returns table (
  id uuid,
  short_id text,
  slug text,
  listing_type text,
  property_type text,
  title text,
  bhk smallint,
  bathrooms smallint,
  area_sqft numeric,
  price bigint,
  furnishing text,
  locality text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  featured boolean,
  label text,
  published_at timestamptz,
  cover_path text,
  cover_alt text,
  total_count bigint,
  distance_km double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  place_given boolean := p_lat is not null or p_lng is not null;
  box_given boolean := p_west is not null or p_south is not null or p_east is not null or p_north is not null;
  keyword text := nullif(btrim(p_q), '');
  place_text text := nullif(btrim(p_locality), '');
  city_filter text := public.city_key(p_city);
  order_by text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 120 then
    raise exception 'search.invalid_limit' using errcode = '22023';
  end if;
  -- `distance` needs a place to measure from.
  if p_sort is null
    or p_sort not in ('newest', 'price_asc', 'price_desc', 'area_desc', 'distance')
    or (p_sort = 'distance' and not place_given) then
    raise exception 'search.invalid_sort' using errcode = '22023';
  end if;
  if p_label is not null and p_label not in ('featured', 'prime', 'budget') then
    raise exception 'search.invalid_label' using errcode = '22023';
  end if;
  if p_listing_type is not null and p_listing_type not in ('sale', 'rent') then
    raise exception 'search.invalid_listing_type' using errcode = '22023';
  end if;
  if p_property_type is not null
    and p_property_type not in ('apartment', 'villa', 'house', 'plot', 'commercial') then
    raise exception 'search.invalid_property_type' using errcode = '22023';
  end if;
  if p_bhk is not null and (p_bhk < 0 or p_bhk > 10) then
    raise exception 'search.invalid_bhk' using errcode = '22023';
  end if;
  if (p_min_price is not null and p_min_price < 0) or (p_max_price is not null and p_max_price < 0) then
    raise exception 'search.invalid_price' using errcode = '22023';
  end if;
  if place_given then
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'search.invalid_place' using errcode = '22023';
    end if;
    if p_radius_km is null or p_radius_km < 1 or p_radius_km > 50 then
      raise exception 'search.invalid_radius' using errcode = '22023';
    end if;
  end if;
  if box_given then
    if p_west is null or p_south is null or p_east is null or p_north is null
      or p_west not between -180 and 180 or p_east not between -180 and 180
      or p_south not between -90 and 90 or p_north not between -90 and 90
      or p_south > p_north or p_west > p_east then
      raise exception 'search.invalid_box' using errcode = '22023';
    end if;
  end if;
  if keyword is not null and char_length(keyword) > 120 then
    raise exception 'search.invalid_keyword' using errcode = '22023';
  end if;
  if place_text is not null and char_length(place_text) > 80 then
    raise exception 'search.invalid_locality' using errcode = '22023';
  end if;
  if p_city is not null and (char_length(p_city) > 80 or city_filter is null) then
    raise exception 'search.invalid_city' using errcode = '22023';
  end if;

  -- Only these five fixed texts are ever put into the statement; the caller's values are passed as
  -- parameters. Ties are broken by id, so the same search always returns the same order. `distance_m` has
  -- no table prefix on purpose: in the inner query it is the output column of that name, in the outer one
  -- it is the column the inner query hands up.
  order_by := case p_sort
    when 'newest' then 'found.published_at desc, found.id'
    when 'price_asc' then 'found.price, found.id'
    when 'price_desc' then 'found.price desc, found.id desc'
    when 'distance' then 'distance_m, found.id'
    else 'found.area_sqft desc nulls last, found.id'
  end;

  -- The inner query finds, counts, sorts and cuts the page. The outer query only adds the cover photo
  -- and the derived columns to those rows. Both name their rows `found`, so the one ordering text
  -- serves both: the join does not promise to keep the inner order, so the outer query sorts again.
  -- distance_m is in metres, from the picked point to the public (rounded) point, and is null without a
  -- place. The outer query turns it into kilometres with one decimal.
  return query execute format($sql$
    select
      found.id, found.short_id, found.slug, found.listing_type, found.property_type, found.title,
      found.bhk, found.bathrooms, found.area_sqft, found.price, found.furnishing, found.locality,
      found.city, found.state,
      extensions.st_y(found.public_location::extensions.geometry),
      extensions.st_x(found.public_location::extensions.geometry),
      found.featured,
      public.listing_label(found.price, found.listing_type, found.featured),
      found.published_at,
      cover.storage_path,
      cover.alt_text,
      found.total_count,
      round((found.distance_m / 1000)::numeric, 1)::double precision
    from (
      select
        found.id, found.short_id, found.slug, found.listing_type, found.property_type, found.title,
        found.bhk, found.bathrooms, found.area_sqft, found.price, found.furnishing, found.locality,
        found.city, found.state, found.public_location, found.featured, found.published_at,
        case when $7::boolean then extensions.st_distance(
          found.public_location,
          extensions.st_setsrid(extensions.st_makepoint($9, $8), 4326)::extensions.geography
        ) end as distance_m,
        count(*) over () as total_count
      from public.properties as found
      where found.status = 'approved'
        and ($1::text is null or found.listing_type = $1)
        and ($2::text is null or found.property_type = $2)
        and ($3::integer is null or found.bhk = $3)
        and ($4::bigint is null or found.price >= $4)
        and ($5::bigint is null or found.price <= $5)
        and ($6::text is null or strpos(lower(found.locality), lower($6)) > 0)
        and (not $7::boolean or extensions.st_dwithin(
          found.public_location,
          extensions.st_setsrid(extensions.st_makepoint($9, $8), 4326)::extensions.geography,
          $10 * 1000
        ))
        and (not $11::boolean or found.public_location operator(extensions.&&)
          extensions.st_makeenvelope($12, $13, $14, $15, 4326)::extensions.geography)
        and ($16::text is null or found.search_vector
          @@ pg_catalog.websearch_to_tsquery('simple'::regconfig, $16))
        and ($17::text is null
          or public.listing_label(found.price, found.listing_type, found.featured) = $17)
        and ($19::text is null or public.city_key(found.city) = $19)
      order by %1$s
      limit $18
    ) as found
    left join lateral (
      select media.storage_path, media.alt_text
      from public.listing_media as media
      where media.listing_id = found.id and media.is_cover
      limit 1
    ) as cover on true
    order by %1$s
  $sql$, order_by)
  using p_listing_type, p_property_type, p_bhk, p_min_price, p_max_price, place_text,
    place_given, p_lat, p_lng, p_radius_km,
    box_given, p_west, p_south, p_east, p_north,
    keyword, p_label, p_limit, city_filter;
end;
$$;

revoke execute on function public.search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer, text
) from public;
grant execute on function public.search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer, text
) to anon, authenticated, service_role;
