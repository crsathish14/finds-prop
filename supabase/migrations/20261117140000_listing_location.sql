-- Place search PR 7a (ADR-138): a listing's location is required to submit it, and one function sets it.
-- Rules: ADR-060 (a listing may be submitted without coordinates; replaced for new submissions only),
-- DEC-09 policy C (a moderated field of an approved listing sends it back to review, in guard_properties),
-- DEC-35 (the exact `location` is private, `public_location` is its rounded generated copy), FR-GEO-03.
-- Two changes:
--   1. set_listing_location(listing, latitude, longitude): the write path the app uses for
--      properties.location. It runs as the caller (security invoker): owners already hold the column's
--      update grant, so no grant or policy changes. The caller must be the signed-in owner, the point must
--      be a real latitude and longitude inside the region bounds of the site settings, and a sold or
--      rented listing is closed. On an approved listing the move is a moderated change: the existing guard
--      (policy C) sends the listing back to review, exactly as for a title or address change; the function
--      returns the status so the screen can say so.
--   2. submit_listing refuses a listing that has no location (listing.location_required, 23514). This is
--      a rule of the function only: properties_complete_unless_draft is not changed, so existing drafts
--      and live listings without a location stay valid; only a new submission is refused.
-- Errors of set_listing_location (message, code): listing.not_allowed 42501 (no session, or no verified
-- phone), listing.location_invalid 22023 (a number missing, not finite or out of range),
-- listing.location_out_of_region 22023, listing.not_found P0002 (also for someone else's listing),
-- listing.not_editable 55000 (sold or rented).
-- Rollback note: nothing is stored or removed. To undo, drop set_listing_location(uuid, double precision,
-- double precision) and put submit_listing back as in 20261107140000_listing_submit.sql (create or replace,
-- without the location check); fix forward with a new migration.

-- Returns the listing's status after the change: approved when nothing moved, pending when a live
-- listing went back to review. Nothing in the request says who is asking: the owner is the session.
-- site_settings is public by design, so the region bounds are read with the caller's own rights.
create function public.set_listing_location(
  p_property_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  region_bounds jsonb;
  south double precision;
  north double precision;
  west double precision;
  east double precision;
  current_status text;
  new_status text;
begin
  if caller is null or not (select public.has_verified_phone()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;

  -- NaN and the infinities sort above every number, so a range test refuses them too.
  if p_lat is null or p_lng is null
    or not (p_lat between -90 and 90) or not (p_lng between -180 and 180)
  then
    raise exception 'listing.location_invalid' using errcode = '22023';
  end if;

  -- With no usable bounds the region is unset and only the numeric range above applies.
  select value -> 'bounds' into region_bounds from public.site_settings where key = 'region';
  if jsonb_typeof(region_bounds -> 'south') = 'number' and jsonb_typeof(region_bounds -> 'north') = 'number'
    and jsonb_typeof(region_bounds -> 'west') = 'number' and jsonb_typeof(region_bounds -> 'east') = 'number'
  then
    south := (region_bounds ->> 'south')::double precision;
    north := (region_bounds ->> 'north')::double precision;
    west := (region_bounds ->> 'west')::double precision;
    east := (region_bounds ->> 'east')::double precision;
    if south <= north and west <= east
      and not (p_lat between south and north and p_lng between west and east)
    then
      raise exception 'listing.location_out_of_region' using errcode = '22023';
    end if;
  end if;

  -- Users cannot read owner_id, so ownership is asked of the definer helper; the update policy then
  -- lets through only the caller's own rows.
  if not (select public.owns_property(p_property_id)) then
    raise exception 'listing.not_found' using errcode = 'P0002';
  end if;
  select p.status into current_status from public.properties as p where p.id = p_property_id for update;
  if not found then
    raise exception 'listing.not_found' using errcode = 'P0002';
  end if;
  if current_status in ('sold', 'rented') then
    raise exception 'listing.not_editable' using errcode = '55000';
  end if;

  -- Longitude first. public_location follows by itself (generated, rounded to about 100 m).
  update public.properties as p
  set location = extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  where p.id = p_property_id
  returning p.status into new_status;
  return new_status;
end;
$$;

revoke execute on function public.set_listing_location(uuid, double precision, double precision)
  from public, anon, authenticated, service_role;
grant execute on function public.set_listing_location(uuid, double precision, double precision)
  to authenticated;

-- Same function as in 20261107140000_listing_submit.sql with one more refusal, after the completeness
-- check: a listing with no location. Errors: listing.not_allowed 42501, listing.not_found P0002,
-- listing.not_submittable 55000, listing.incomplete 23514 (detail: the missing columns),
-- listing.location_required 23514, listing.no_photo 23514, properties.open_limit.
create or replace function public.submit_listing(p_listing uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  listing public.properties%rowtype;
  missing text[];
begin
  if caller is null or not (select public.has_verified_phone()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;

  select * into listing
  from public.properties
  where id = p_listing and owner_id = caller
  for update;
  if not found then
    raise exception 'listing.not_found' using errcode = 'P0002';
  end if;
  if listing.status not in ('draft', 'rejected') then
    raise exception 'listing.not_submittable' using errcode = '55000';
  end if;

  missing := array_remove(array[
    case when listing.listing_type is null then 'listing_type' end,
    case when listing.property_type is null then 'property_type' end,
    case when listing.title is null then 'title' end,
    case when listing.price is null then 'price' end,
    case when listing.area_sqft is null then 'area_sqft' end,
    case when listing.address is null then 'address' end,
    case when listing.locality is null then 'locality' end,
    case when listing.city is null then 'city' end,
    case when listing.state is null then 'state' end,
    case when listing.pincode is null then 'pincode' end
  ], null);
  if cardinality(missing) > 0 then
    raise exception 'listing.incomplete' using errcode = '23514', detail = array_to_string(missing, ',');
  end if;

  if listing.location is null then
    raise exception 'listing.location_required' using errcode = '23514';
  end if;

  if not exists (select 1 from public.listing_media where listing_id = p_listing) then
    raise exception 'listing.no_photo' using errcode = '23514';
  end if;

  if listing.status = 'rejected' then
    perform public.assert_open_listing_room();
  end if;

  -- The guard treats this definer function as the system, so the move to pending is allowed, stamps
  -- submitted_at and clears any rejection reason; the audit trigger records it.
  update public.properties set status = 'pending' where id = p_listing;
  return listing.short_id;
end;
$$;
