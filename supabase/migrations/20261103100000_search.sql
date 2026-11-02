-- F10 search: the listing label, the search function and the indexes behind it.
-- Rules: BR-90 (only approved listings are searched), BR-91 (the filters), BR-92 (the labels),
-- ADR-012 (search architecture), ADR-017 (column grants), plan 06 section 9.
-- search_properties() runs as the caller (SECURITY INVOKER), so it can only read what Row Level
-- Security and the column grants already allow. That is why the radius and the map box use
-- public_location (the point rounded to about 100 m) and never the exact location, which no visitor
-- can read (Q1). The plan's text says `location`; the grants make `public_location` the only choice.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

-- The keyword vector holds the title, locality and city only (the private address is left out), so
-- showing it to visitors reveals nothing the listing page does not. The search reads it as the caller.
grant select (search_vector) on table public.properties to anon, authenticated;

-- Featured wins; then Prime (sale from 1.5 crore, rent from 60,000 a month); then Budget (sale up to
-- 60 lakh, rent up to 20,000 a month); otherwise no label. The limits are in rupees and inclusive.
-- config/vocab.ts mirrors them from Stage 4 (UT-label asserts they are equal).
create function public.listing_label(listing_price bigint, listing_kind text, is_featured boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when is_featured then 'featured'
    when listing_price is null or listing_kind is null then null
    when listing_kind = 'sale' and listing_price >= 15000000 then 'prime'
    when listing_kind = 'rent' and listing_price >= 60000 then 'prime'
    when listing_kind = 'sale' and listing_price <= 6000000 then 'budget'
    when listing_kind = 'rent' and listing_price <= 20000 then 'budget'
    else null
  end
$$;

-- Approved listings only, so each index is as small as the part of the table it serves.
create index properties_search_newest on public.properties (published_at desc, id)
  where status = 'approved';
create index properties_search_price on public.properties (price, id)
  where status = 'approved';
create index properties_search_area on public.properties (area_sqft desc nulls last, id)
  where status = 'approved';
create index properties_search_filters on public.properties (listing_type, property_type, bhk, price)
  where status = 'approved';
create index properties_search_place on public.properties
  using gist (public_location) where status = 'approved';
create index properties_search_keyword on public.properties
  using gin (search_vector) where status = 'approved';

-- The visitor-facing search. Every argument is optional. The caller (the app's Zod schema) has
-- already dropped what it does not understand; this function checks the ranges again and refuses
-- anything outside them. Returns explicit public columns, never owner_id, the address or the exact
-- location, and total_count (the number of matches before the limit) on every row.
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
  p_limit integer default 12
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
  total_count bigint
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
  order_by text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 120 then
    raise exception 'search.invalid_limit' using errcode = '22023';
  end if;
  if p_sort is null or p_sort not in ('newest', 'price_asc', 'price_desc', 'area_desc') then
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

  -- Only these four fixed texts are ever put into the statement; the caller's values are passed as
  -- parameters. Ties are broken by id, so the same search always returns the same order.
  order_by := case p_sort
    when 'newest' then 'found.published_at desc, found.id'
    when 'price_asc' then 'found.price, found.id'
    when 'price_desc' then 'found.price desc, found.id desc'
    else 'found.area_sqft desc nulls last, found.id'
  end;

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
      count(*) over ()
    from public.properties as found
    left join lateral (
      select media.storage_path, media.alt_text
      from public.listing_media as media
      where media.listing_id = found.id and media.is_cover
      limit 1
    ) as cover on true
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
    order by %s
    limit $18
  $sql$, order_by)
  using p_listing_type, p_property_type, p_bhk, p_min_price, p_max_price, place_text,
    place_given, p_lat, p_lng, p_radius_km,
    box_given, p_west, p_south, p_east, p_north,
    keyword, p_label, p_limit;
end;
$$;

revoke execute on function public.listing_label(bigint, text, boolean) from public;
grant execute on function public.listing_label(bigint, text, boolean) to anon, authenticated, service_role;
revoke execute on function public.search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer
) from public;
grant execute on function public.search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer
) to anon, authenticated, service_role;
