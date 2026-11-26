-- F10 and F04 follow-up (ADR-210, AI search plan Phase 1c, owner decision 26 Nov 2026): the Featured switch of a home
-- and of a project gets an optional first and last day, set by the super admin when pressing Feature.
--
-- Days are India dates. A home or project with dates is featured from the beginning of its first day to the end of its
-- last; no first day means from now, no last day means until the admin removes it. The switch itself (`featured`) stays
-- the one column every read uses (search, the home page, the detail pages, the project list, the AI): a job every 15
-- minutes turns it on when the first day arrives and off when the last day has passed, so none of those reads changes
-- (the owner's choice of approach A). A row without dates is left as it is, so Feature without dates works as before.
--
-- A home is featured only while approved (the table's own rule). A project is featured unless rejected, as today: a
-- live project a builder edited stays featured while it waits for review.
--
-- The new columns are written only through `moderate_listing` and `moderate_project` (no client holds an update grant on
-- them; the lifecycle guards already let only the system change `featured`).
--
-- Rollback note: additive. To undo, unschedule the job (`select cron.unschedule('featured-dates')`), drop
-- `apply_featured_dates`, put back the two moderation functions and the two admin lists from their earlier migrations,
-- then drop the four columns. Fix forward by preference.

-- 1. The dates.
alter table public.properties
  add column featured_from date,
  add column featured_until date,
  add constraint properties_featured_dates_order
    check (featured_from is null or featured_until is null or featured_until >= featured_from);

alter table public.projects
  add column featured_from date,
  add column featured_until date,
  add constraint projects_featured_dates_order
    check (featured_from is null or featured_until is null or featured_until >= featured_from);

-- 2. The admin's decision on a listing, now with the dates of a feature.
drop function public.moderate_listing(uuid, text, text);

create function public.moderate_listing(
  p_listing uuid,
  p_action text,
  p_reason text default null,
  p_featured_from date default null,
  p_featured_until date default null
)
returns table (id uuid, short_id text, status text, featured boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  listing public.properties%rowtype;
  reason constant text := nullif(btrim(coalesce(p_reason, '')), '');
  today constant date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if caller is null or not (select public.is_super_admin()) then
    raise exception 'listing.not_allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('approve', 'reject', 'feature', 'unfeature') then
    raise exception 'listing.bad_action' using errcode = '22023';
  end if;
  if p_featured_from is not null and p_featured_until is not null and p_featured_until < p_featured_from then
    raise exception 'listing.bad_dates' using errcode = '22023';
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
    -- Featuring an approved home sets its dates (none, as before, means from now until removed) and switches it on
    -- only if today is inside them. Featuring a home already featured without dates, with no dates, changes nothing.
    if listing.status <> 'approved' then
      raise exception 'listing.not_featurable' using errcode = '55000';
    end if;
    if listing.featured and listing.featured_from is null and listing.featured_until is null
      and p_featured_from is null and p_featured_until is null
    then
      raise exception 'listing.not_featurable' using errcode = '55000';
    end if;
    update public.properties as p
    set featured_from = p_featured_from,
        featured_until = p_featured_until,
        featured = (p_featured_from is null or p_featured_from <= today)
          and (p_featured_until is null or today <= p_featured_until)
    where p.id = p_listing;
  else
    if not listing.featured and listing.featured_from is null and listing.featured_until is null then
      raise exception 'listing.not_featurable' using errcode = '55000';
    end if;
    update public.properties as p
    set featured = false, featured_from = null, featured_until = null
    where p.id = p_listing;
  end if;

  return query
    select p.id, p.short_id, p.status, p.featured from public.properties as p where p.id = p_listing;
end;
$$;

revoke execute on function public.moderate_listing(uuid, text, text, date, date) from public, anon, authenticated;
grant execute on function public.moderate_listing(uuid, text, text, date, date) to authenticated, service_role;

-- 3. The admin's decision on a project, now with the dates of a feature.
drop function public.moderate_project(uuid, text, text);

create function public.moderate_project(
  p_project uuid,
  p_action text,
  p_reason text default null,
  p_featured_from date default null,
  p_featured_until date default null
)
returns table (id uuid, slug text, moderation text, published boolean, featured boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  target public.projects%rowtype;
  -- The approved screen asks for no reason, but a rejected project must carry one (the table's own rule).
  reason constant text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Rejected by an admin.');
  today constant date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if caller is null or not (select public.is_super_admin()) then
    raise exception 'project.not_allowed' using errcode = '42501';
  end if;
  if p_action is null
    or p_action not in ('approve', 'reject', 'publish', 'unpublish', 'feature', 'unfeature')
  then
    raise exception 'project.bad_action' using errcode = '22023';
  end if;
  if char_length(reason) > 500 then
    raise exception 'project.bad_action' using errcode = '22023';
  end if;
  if p_featured_from is not null and p_featured_until is not null and p_featured_until < p_featured_from then
    raise exception 'project.bad_dates' using errcode = '22023';
  end if;

  select * into target from public.projects as p where p.id = p_project for update;
  if not found then
    raise exception 'project.not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    -- A pending project is reviewed; a rejected one can be approved later. Whether it is published is not touched.
    if target.moderation not in ('pending', 'rejected') then
      raise exception 'project.not_reviewable' using errcode = '55000';
    end if;
    update public.projects as p
    set moderation = 'approved', rejection_reason = null, moderated_by = caller, moderated_at = now()
    where p.id = p_project;
  elsif p_action = 'reject' then
    if target.moderation <> 'pending' then
      raise exception 'project.not_reviewable' using errcode = '55000';
    end if;
    -- A rejected project is off the site and neither published nor featured.
    update public.projects as p
    set moderation = 'rejected', rejection_reason = reason, published = false, featured = false,
        moderated_by = caller, moderated_at = now()
    where p.id = p_project;
  elsif p_action = 'publish' then
    if target.moderation <> 'approved' or target.published then
      raise exception 'project.not_publishable' using errcode = '55000';
    end if;
    update public.projects as p set published = true where p.id = p_project;
  elsif p_action = 'unpublish' then
    if not target.published then
      raise exception 'project.not_publishable' using errcode = '55000';
    end if;
    update public.projects as p set published = false where p.id = p_project;
  elsif p_action = 'feature' then
    -- As for a home: the dates are set and the switch follows them today.
    if target.moderation <> 'approved' then
      raise exception 'project.not_featurable' using errcode = '55000';
    end if;
    if target.featured and target.featured_from is null and target.featured_until is null
      and p_featured_from is null and p_featured_until is null
    then
      raise exception 'project.not_featurable' using errcode = '55000';
    end if;
    update public.projects as p
    set featured_from = p_featured_from,
        featured_until = p_featured_until,
        featured = (p_featured_from is null or p_featured_from <= today)
          and (p_featured_until is null or today <= p_featured_until)
    where p.id = p_project;
  else
    if not target.featured and target.featured_from is null and target.featured_until is null then
      raise exception 'project.not_featurable' using errcode = '55000';
    end if;
    update public.projects as p
    set featured = false, featured_from = null, featured_until = null
    where p.id = p_project;
  end if;

  return query
    select p.id, p.slug, p.moderation, p.published, p.featured
    from public.projects as p where p.id = p_project;
end;
$$;

revoke execute on function public.moderate_project(uuid, text, text, date, date) from public, anon, authenticated;
grant execute on function public.moderate_project(uuid, text, text, date, date) to authenticated, service_role;

-- 4. The job: every dated home and project whose switch does not match today is put right. Counts only are returned.
create function public.apply_featured_dates()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today constant date := (now() at time zone 'Asia/Kolkata')::date;
  homes integer;
  projects integer;
begin
  update public.properties as p
  set featured = target.wanted
  from (
    select home.id,
      home.status = 'approved'
        and (home.featured_from is null or home.featured_from <= today)
        and (home.featured_until is null or today <= home.featured_until) as wanted
    from public.properties as home
    where home.featured_from is not null or home.featured_until is not null
  ) as target
  where p.id = target.id and p.featured is distinct from target.wanted;
  get diagnostics homes = row_count;

  update public.projects as p
  set featured = target.wanted
  from (
    select project.id,
      project.moderation <> 'rejected'
        and (project.featured_from is null or project.featured_from <= today)
        and (project.featured_until is null or today <= project.featured_until) as wanted
    from public.projects as project
    where project.featured_from is not null or project.featured_until is not null
  ) as target
  where p.id = target.id and p.featured is distinct from target.wanted;
  get diagnostics projects = row_count;

  return jsonb_build_object('homes', homes, 'projects', projects);
end;
$$;

revoke execute on function public.apply_featured_dates() from public, anon, authenticated;
grant execute on function public.apply_featured_dates() to service_role;

-- Every 15 minutes. Scheduling again under the same name replaces the job.
select cron.schedule('featured-dates', '*/15 * * * *', 'select public.apply_featured_dates()');

-- 5. The admin's lists show the dates, so the moderation screens can tag a feature Scheduled, Running or Ended.
drop function public.admin_listing_queue(text, text, text, timestamptz, uuid, integer);

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
  featured_from date,
  featured_until date,
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
      p.id, p.short_id, p.status, p.featured, p.featured_from, p.featured_until, p.listing_type, p.property_type,
      p.title, p.description, p.bhk, p.bathrooms, p.area_sqft, p.price, p.furnishing, p.amenities, p.address,
      p.locality, p.city, p.pincode, p.rejection_reason, p.submitted_at,
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

revoke execute on function public.admin_listing_queue(text, text, text, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.admin_listing_queue(text, text, text, timestamptz, uuid, integer)
  to authenticated, service_role;

drop function public.admin_project_overview();

create function public.admin_project_overview()
returns table (
  id uuid,
  name text,
  slug text,
  locality text,
  price bigint,
  price_type text,
  cover text,
  moderation text,
  published boolean,
  featured boolean,
  featured_from date,
  featured_until date,
  builder_id uuid,
  builder_name text,
  leads bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'project.not_allowed' using errcode = '42501';
  end if;
  return query
  select
    project.id,
    project.name,
    project.slug,
    project.locality,
    project.price,
    project.price_type,
    project.images[1],
    project.moderation,
    project.published,
    project.featured,
    project.featured_from,
    project.featured_until,
    project.builder_id,
    builder.name,
    (select count(*) from public.project_leads as lead where lead.project_id = project.id),
    project.created_at
  from public.projects as project
  join public.builders as builder on builder.id = project.builder_id
  order by project.created_at desc, project.id;
end;
$$;

revoke execute on function public.admin_project_overview() from public, anon, authenticated;
grant execute on function public.admin_project_overview() to authenticated, service_role;
