-- F06 listing submit (S6-T02, part 1): the database side of the post-property wizard.
-- Rules: BR-20 (a new listing is Pending, owned by the poster), DEC-09 (policy C, already in
-- guard_properties), DEC-19 fallback (a listing may be submitted without coordinates), DEC-26 (at most
-- five draft plus pending listings per person), plan 06 section 6.2 (submit_listing), FR-ACC-06.
-- Three changes:
--   1. properties_complete_unless_draft no longer demands `location` or `description`. The wizard has
--      no map pin yet, and the approved screens call the description optional. A listing without a
--      location is left out of radius and map results (the public_location comparisons are null for it)
--      but still appears in keyword and locality search. Adding a location later is a moderated change
--      (guard_properties already sends an approved listing back to Pending for it).
--   2. A person may hold at most `listings.max_open` (default 5) listings in draft or pending. The
--      rule is a trigger, because owners may insert into properties directly; system contexts (seed,
--      migrations, service role) are not limited.
--   3. submit_listing(listing_id): the only way a user moves a listing to Pending.
-- Rollback note: nothing here is destructive. To undo, drop the trigger and the three functions and
-- restore the old check; fix forward with a new migration.

alter table public.properties drop constraint properties_complete_unless_draft;
alter table public.properties add constraint properties_complete_unless_draft check (
  status = 'draft' or (
    listing_type is not null and property_type is not null and title is not null
    and price is not null and area_sqft is not null
    and locality is not null and city is not null and state is not null
    and pincode is not null and address is not null
  )
);

insert into public.app_config (key, value, description)
values (
  'listings.max_open', '5',
  'Most listings one person may have in draft or pending at the same time (DEC-26)'
)
on conflict (key) do nothing;

-- Refuses the signed-in person a new open listing when they already hold the limit. The count and
-- the setting are read with definer rights (users cannot read owner_id in a query, nor app_config).
-- A lock per person stops two requests at the same moment from both slipping under the limit.
create function public.assert_open_listing_room()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  open_limit integer;
begin
  if caller is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('open_listings:' || caller::text, 0));
  select case when value ~ '^[0-9]{1,4}$' then value::integer end
  into open_limit
  from public.app_config
  where key = 'listings.max_open';
  if (
    select count(*) from public.properties
    where owner_id = caller and status in ('draft', 'pending')
  ) >= coalesce(open_limit, 5) then
    raise exception 'properties.open_limit';
  end if;
end;
$$;

-- Runs with the caller's rights on purpose: only then can it tell a user from the system.
create function public.properties_open_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  -- Someone with no verified phone cannot insert at all (the insert policy refuses it); leave that
  -- refusal to the policy so it does not turn into a different error.
  if not (select public.has_verified_phone()) then
    return new;
  end if;
  perform public.assert_open_listing_room();
  return new;
end;
$$;

-- Moves the caller's own listing from draft (or rejected) to pending, after checking it is complete
-- and has a photo. Returns the listing's short id. Nothing in the request says who is asking: the
-- owner is the session. A listing that is not theirs looks the same as one that does not exist.
-- Errors (message, code): listing.not_allowed 42501, listing.not_found P0002, listing.not_submittable
-- 55000, listing.incomplete 23514 (detail: the missing columns), listing.no_photo 23514,
-- properties.open_limit (a rejected listing goes back into the count; a draft is already in it).
create function public.submit_listing(p_listing uuid)
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

revoke execute on function public.assert_open_listing_room() from public, anon, authenticated;
revoke execute on function public.properties_open_cap() from public, anon, authenticated;
revoke execute on function public.submit_listing(uuid) from public, anon, authenticated;
grant execute on function public.assert_open_listing_room() to authenticated, service_role;
grant execute on function public.submit_listing(uuid) to authenticated, service_role;

-- Fires after properties_guard and properties_identity (trigger names sort in firing order).
create trigger properties_open_cap
  before insert on public.properties
  for each row execute function public.properties_open_cap();
