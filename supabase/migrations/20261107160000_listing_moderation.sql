-- F10 listing moderation (S6-T04, FR-ADM-02): the admin's queue and decisions.
--
-- Everything here is for a super admin and nobody else: each function checks the caller itself, so a
-- missing grant or a mistake in a grant can never open it. The decisions run as the function's owner,
-- which the lifecycle guard treats as the system, so the status, featured and moderation columns can
-- change only through here (BR-23 to BR-25); the audit trigger records each change with the admin as
-- the actor.
--
-- Errors (message, code): listing.not_allowed 42501, listing.not_found P0002, listing.bad_action 22023,
-- listing.bad_filter 22023, listing.reason_required 23514, listing.not_reviewable 55000 (approve or
-- reject a listing that is not pending), listing.not_featurable 55000 (feature one that is not
-- approved, or remove a feature it does not have).

-- A rejection keeps its reason in the audit entry too: the row loses it when the owner resubmits.
create or replace function public.audit_properties()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.audit_write('listing.deleted', 'property', old.id::text, jsonb_build_object('status', old.status));
  else
    perform public.audit_write(
      'listing.status_changed', 'property', new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'from', old.status,
        'to', new.status,
        'featured', new.featured,
        'reason', case when new.status = 'rejected' then new.rejection_reason end
      ))
    );
  end if;
  return null;
end;
$$;

-- The decision on one listing. Returns what the page needs afterwards: the short id (for the cache tags),
-- the new status and whether it is featured.
create function public.moderate_listing(p_listing uuid, p_action text, p_reason text default null)
returns table (id uuid, short_id text, status text, featured boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  listing public.properties%rowtype;
  reason constant text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if caller is null or not (select public.is_super_admin()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('approve', 'reject', 'feature', 'unfeature') then
    raise exception 'listing.bad_action' using errcode = '22023';
  end if;

  select * into listing from public.properties as p where p.id = p_listing for update;
  if not found then
    raise exception 'listing.not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    if listing.status <> 'pending' then
      raise exception 'listing.not_reviewable' using errcode = '55000';
    end if;
    update public.properties as p
    set status = 'approved', rejection_reason = null, moderated_by = caller, moderated_at = now()
    where p.id = p_listing;
  elsif p_action = 'reject' then
    if listing.status <> 'pending' then
      raise exception 'listing.not_reviewable' using errcode = '55000';
    end if;
    if reason is null or char_length(reason) > 500 then
      raise exception 'listing.reason_required' using errcode = '23514';
    end if;
    update public.properties as p
    set status = 'rejected', rejection_reason = reason, moderated_by = caller, moderated_at = now()
    where p.id = p_listing;
  elsif p_action = 'feature' then
    if listing.status <> 'approved' or listing.featured then
      raise exception 'listing.not_featurable' using errcode = '55000';
    end if;
    update public.properties as p set featured = true where p.id = p_listing;
  else
    if not listing.featured then
      raise exception 'listing.not_featurable' using errcode = '55000';
    end if;
    update public.properties as p set featured = false where p.id = p_listing;
  end if;

  return query
    select p.id, p.short_id, p.status, p.featured from public.properties as p where p.id = p_listing;
end;
$$;

-- The numbers on the tabs and in the sidebar. Drafts are the owner's own business and never counted.
create function public.admin_listing_counts()
returns table (pending integer, approved integer, rejected integer, closed integer, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;
  return query
    select
      (count(*) filter (where p.status = 'pending'))::integer,
      (count(*) filter (where p.status = 'approved'))::integer,
      (count(*) filter (where p.status = 'rejected'))::integer,
      (count(*) filter (where p.status in ('sold', 'rented')))::integer,
      count(*)::integer
    from public.properties as p
    where p.status <> 'draft';
end;
$$;

-- The localities to filter by: those with a listing in the queue, in order.
create function public.admin_listing_localities()
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;
  return query
    select distinct p.locality
    from public.properties as p
    where p.status <> 'draft' and p.locality is not null
    order by p.locality
    limit 200;
end;
$$;

-- One page of the queue, newest submission first, with everything the review drawer shows (so opening it
-- needs no second read): the complete listing, its photos in order, and who posted it. Paged by the last
-- row seen (p_after_at, p_after_id), not by offset, so a decision made meanwhile cannot skip a row.
-- p_tab: pending | approved | rejected | closed (sold or rented) | all (every non-draft).
create function public.admin_listing_queue(
  p_tab text default 'pending',
  p_locality text default null,
  p_kind text default null,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  short_id text,
  status text,
  featured boolean,
  listing_type text,
  property_type text,
  title text,
  description text,
  bhk smallint,
  bathrooms smallint,
  area_sqft numeric,
  price bigint,
  furnishing text,
  amenities text[],
  address text,
  locality text,
  city text,
  pincode text,
  rejection_reason text,
  submitted_at timestamptz,
  owner_name text,
  owner_email text,
  photos jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;
  if p_tab is null or p_tab not in ('pending', 'approved', 'rejected', 'closed', 'all')
    or (p_kind is not null and p_kind not in ('sale', 'rent'))
    or (p_after_at is null) <> (p_after_id is null)
  then
    raise exception 'listing.bad_filter' using errcode = '22023';
  end if;

  return query
    select
      p.id, p.short_id, p.status, p.featured, p.listing_type, p.property_type, p.title, p.description,
      p.bhk, p.bathrooms, p.area_sqft, p.price, p.furnishing, p.amenities, p.address, p.locality,
      p.city, p.pincode, p.rejection_reason, p.submitted_at,
      pr.full_name,
      u.email::text,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', m.id, 'path', m.storage_path, 'position', m.position)
          order by m.position, m.created_at
        )
        from public.listing_media as m
        where m.listing_id = p.id
      ), '[]'::jsonb)
    from public.properties as p
    left join public.profiles as pr on pr.id = p.owner_id
    left join auth.users as u on u.id = p.owner_id
    where p.status <> 'draft'
      and (
        p_tab = 'all'
        or (p_tab = 'closed' and p.status in ('sold', 'rented'))
        or p.status = p_tab
      )
      and (p_locality is null or p.locality = p_locality)
      and (p_kind is null or p.listing_type = p_kind)
      and (p_after_at is null or (p.submitted_at, p.id) < (p_after_at, p_after_id))
    order by p.submitted_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

revoke execute on function public.moderate_listing(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.admin_listing_counts() from public, anon, authenticated;
revoke execute on function public.admin_listing_localities() from public, anon, authenticated;
revoke execute on function public.admin_listing_queue(text, text, text, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.moderate_listing(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_listing_counts() to authenticated, service_role;
grant execute on function public.admin_listing_localities() to authenticated, service_role;
grant execute on function public.admin_listing_queue(text, text, text, timestamptz, uuid, integer)
  to authenticated, service_role;
