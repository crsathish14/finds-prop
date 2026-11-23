-- Plan 2 (header city selector), part 2: the homepage homes of one city.
-- home_properties() gains an optional second argument, the chosen city (null = every city). It is
-- passed to search_properties(p_city), which compares city keys (city_key), so spelling and case
-- cannot split a city. The result shape and the fixed sizes (six featured, eight newest) are unchanged.
-- Rollback: drop this function and run the body of 20261123180000_public_detail_functions.sql again.

drop function public.home_properties(text);

create function public.home_properties(p_kind text, p_city text default null)
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
security definer
set search_path = ''
as $$
begin
  if p_kind = 'featured' then
    return query select * from public.search_properties(
      p_label => 'featured', p_sort => 'newest', p_limit => 6, p_city => p_city);
  elsif p_kind = 'newest' then
    return query select * from public.search_properties(p_sort => 'newest', p_limit => 8, p_city => p_city);
  else
    raise exception 'home.invalid_kind' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.home_properties(text, text) from public;
grant execute on function public.home_properties(text, text) to anon, authenticated, service_role;
