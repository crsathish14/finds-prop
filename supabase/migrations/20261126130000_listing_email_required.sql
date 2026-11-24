-- A listing needs a verified email to be sent for review, once the site says so (ADR-195, customer email plan PR 1,
-- owner decisions 24 Nov 2026).
-- Until now the page asked for a verified email (the posting gate) but the database did not, so a direct call to the
-- submit action got past it. The rule is switched by a public setting, `posting_requires_verified_email` in
-- site_settings, shaped {"enabled": true}. A missing row, `false` or anything else means off, so every place where
-- nobody can verify an email yet (FLAG_CUSTOMER_EMAIL off) keeps working. The owner flips the setting together
-- with the flag.
-- Scope: only a draft is gated, because the rule is about posting. A listing already in review, live or sent back
-- for changes is not asked again, and drafts can be created and saved with no email.
-- has_verified_email() is SECURITY DEFINER because people cannot read auth.users; it answers only about the
-- caller. Its answer is false for an account whose address is not confirmed or is empty.
-- Rollback note: nothing is stored or removed. To undo, drop has_verified_email() and put submit_listing back as in
-- 20261117140000_listing_location.sql (create or replace, without the email check); fix forward with a new migration.

create function public.has_verified_email()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    where account.id = (select auth.uid())
      and account.email_confirmed_at is not null
      and coalesce(account.email, '') <> ''
  )
$$;

revoke execute on function public.has_verified_email() from public, anon, authenticated;
grant execute on function public.has_verified_email() to authenticated, service_role;

-- Same function as in 20261117140000_listing_location.sql with one more refusal, right after the status check and
-- before the completeness checks: a draft sent for review by an account with no verified email while the setting
-- is on. Errors: listing.not_allowed 42501, listing.not_found P0002, listing.not_submittable 55000,
-- listing.email_required 42501 (new), listing.incomplete 23514 (detail: the missing columns),
-- listing.location_required 23514, listing.no_photo 23514, properties.open_limit.
-- site_settings is public by design, so the switch is read with the function's own rights like any other setting.
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

  -- Only a draft: a rejected listing was sent before and goes back without asking again. An unreadable or
  -- malformed setting counts as off.
  if listing.status = 'draft'
    and exists (
      select 1 from public.site_settings
      where key = 'posting_requires_verified_email' and value -> 'enabled' = 'true'::jsonb
    )
    and not (select public.has_verified_email())
  then
    raise exception 'listing.email_required' using errcode = '42501';
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
