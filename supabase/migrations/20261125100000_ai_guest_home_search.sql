-- AI chat for guests (owner decision, 23 Nov 2026): a visitor who is not signed in may search homes in the assistant
-- (inside the 2-chat guest limit and the rate limits), but not projects.
-- Why a function of its own: part C closed `search_properties()` and the home tables to `anon`, and they stay closed.
-- This wrapper is the only way a guest's homes reach the assistant, and it is NOT callable with the public key: only
-- `service_role` may run it, from the chat endpoint on the server, after the endpoint's own limits have passed. So it cannot
-- be scripted from a browser around those limits. It gives the same card columns as the search (no owner, address, exact
-- point or review note, and nothing about projects), and never more than 10 homes in one call.
-- Rollback note: nothing stored depends on it. To go back, add a migration that drops it.

create function public.guest_search_properties(
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
  p_limit integer default 10,
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
security definer
set search_path = ''
as $$
begin
  return query
    select * from public.search_properties(
      p_listing_type => p_listing_type, p_property_type => p_property_type, p_bhk => p_bhk,
      p_min_price => p_min_price, p_max_price => p_max_price, p_locality => p_locality,
      p_lat => p_lat, p_lng => p_lng, p_radius_km => p_radius_km,
      p_west => p_west, p_south => p_south, p_east => p_east, p_north => p_north,
      p_q => p_q, p_label => p_label, p_sort => p_sort,
      p_limit => least(greatest(coalesce(p_limit, 10), 1), 10), p_city => p_city
    );
end;
$$;

revoke execute on function public.guest_search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.guest_search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer, text
) to service_role;
