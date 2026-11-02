-- F10 search: look up the cover photo for the page only (S4-SPK-01 finding).
-- Rules: BR-90 (only approved listings are searched), BR-91 (the filters), ADR-012 (search
-- architecture), plan 06 section 9.2 (p95 under 100 ms at about 10,000 listings).
-- The first search function (20261103100000_search.sql) joined the cover photo to every matching
-- listing and only then cut the page: a search with no filter looked up about 8,500 covers, each
-- through the Row Level Security policy, to return 12 rows. The inner query now counts, sorts and cuts
-- the page; the cover is looked up for those rows only. Nothing else changes: the same arguments,
-- checks, filters, columns and grants, and the same rows in the same order with the same total_count.
-- create or replace keeps the function's grants, so they are not repeated here.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create or replace function public.search_properties(
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

  -- The inner query finds, counts, sorts and cuts the page. The outer query only adds the cover photo
  -- and the derived columns to those rows. Both name their rows `found`, so the one ordering text
  -- serves both: the join does not promise to keep the inner order, so the outer query sorts again.
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
      found.total_count
    from (
      select
        found.id, found.short_id, found.slug, found.listing_type, found.property_type, found.title,
        found.bhk, found.bathrooms, found.area_sqft, found.price, found.furnishing, found.locality,
        found.city, found.state, found.public_location, found.featured, found.published_at,
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
    keyword, p_label, p_limit;
end;
$$;
