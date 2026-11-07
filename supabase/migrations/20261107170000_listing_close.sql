-- F06 listing close (S6-T03, part 1): the owner marks an approved listing as sold or rented.
-- Rules: BR-21 (a sold or rented listing cannot be undone by its owner), DEC-09 (policy C already in
-- guard_properties), plan 06 section 6.2, FR-ACC-10 (mark as sold or rented; Live listings only).
--
-- An owner cannot set `status` on their own listing (the guard says properties.status_system_only),
-- so closing one is a definer function, the same way submitting (submit_listing) and moderating
-- (moderate_listing) are. The guard treats the function as the system: it allows approved>sold and
-- approved>rented, stamps closed_at and clears featured, and the audit trigger records the change
-- with the owner as the actor. A sold or rented listing is terminal: the guard refuses any later
-- change by its owner (properties.terminal_status), so this cannot be undone.
--
-- Errors (message, code): listing.not_allowed 42501 (no session, or no verified phone),
-- listing.not_found P0002 (also for someone else's listing), listing.bad_outcome 22023 (anything
-- but sold or rented), listing.wrong_outcome 22023 (sold for a rent listing, rented for a sale
-- listing), listing.not_closable 55000 (the listing is not approved).
-- Rollback note: nothing here is destructive. Drop the function to undo; fix forward with a new
-- migration.

create function public.close_listing(p_listing uuid, p_outcome text)
returns table (id uuid, short_id text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  listing public.properties%rowtype;
begin
  if caller is null or not (select public.has_verified_phone()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;
  if p_outcome is null or p_outcome not in ('sold', 'rented') then
    raise exception 'listing.bad_outcome' using errcode = '22023';
  end if;

  select * into listing
  from public.properties as p
  where p.id = p_listing and p.owner_id = caller
  for update;
  if not found then
    raise exception 'listing.not_found' using errcode = 'P0002';
  end if;
  if listing.status <> 'approved' then
    raise exception 'listing.not_closable' using errcode = '55000';
  end if;
  if (p_outcome = 'sold' and listing.listing_type is distinct from 'sale')
    or (p_outcome = 'rented' and listing.listing_type is distinct from 'rent')
  then
    raise exception 'listing.wrong_outcome' using errcode = '22023';
  end if;

  -- The guard treats this definer function as the system, so the move is allowed; it stamps
  -- closed_at and clears featured, and the audit trigger records it.
  update public.properties as p set status = p_outcome where p.id = p_listing;

  return query
    select p.id, p.short_id, p.status from public.properties as p where p.id = p_listing;
end;
$$;

revoke execute on function public.close_listing(uuid, text) from public, anon, authenticated;
grant execute on function public.close_listing(uuid, text) to authenticated, service_role;
