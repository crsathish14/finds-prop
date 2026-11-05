-- F12 public slice (S4-T09 step D1a): the two functions that write project leads and events.
-- Rules: BR-72 (a lead is stored only for a project a visitor can see), BR-71 (events; at most one
-- view per visitor per project per hour), BR-75 (a visitor is a one-way hash, never an address).
-- project_leads and project_events have no client insert (F04). These functions are the only way in,
-- and only the server may call them: the server action has already checked who is calling (a lead
-- needs a signed-in, phone-verified user) and has counted the rate limit (5 leads per visitor per
-- hour, 30 events per visitor per minute) before it reaches here, so the functions grant execute to
-- service_role alone and an anonymous caller with the publishable key cannot call them directly.
-- Rollback note: drop the two functions; nothing else changes. Fix forward with a new migration.

-- A project accepts leads and events only while a visitor can see it: approved, published and its
-- builder active (BR-94). Returns null for any other project, so "no such project", "not yet
-- approved" and "withdrawn" look the same to the caller.
create function public.public_project_id(project_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select project.id
  from public.projects project
  join public.builders builder on builder.id = project.builder_id
  where project.slug = project_slug
    and project.moderation = 'approved'
    and project.published
    and builder.active
$$;

revoke execute on function public.public_project_id(text) from public, anon, authenticated;
grant execute on function public.public_project_id(text) to service_role;

-- Stores one lead and returns its id. The phone arrives as digits only (6 to 15), taken from the
-- caller's verified account by the server. A site visit needs a date from today (India time) to a
-- year ahead; an enquiry keeps no date. Empty email and message are stored as null.
create function public.submit_project_lead(
  p_slug text,
  p_kind text,
  p_name text,
  p_phone text,
  p_visitor_hash text,
  p_email text default null,
  p_message text default null,
  p_visit_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  target uuid;
  lead_id uuid;
begin
  if p_kind not in ('enquiry', 'site_visit') then
    raise exception 'project_lead.kind' using errcode = '22023';
  end if;
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{40}$' then
    raise exception 'project_lead.visitor' using errcode = '22023';
  end if;
  if p_kind = 'site_visit'
    and (p_visit_date is null or p_visit_date < today or p_visit_date > today + 365) then
    raise exception 'project_lead.visit_date' using errcode = '22023';
  end if;

  target := public.public_project_id(p_slug);
  if target is null then
    raise exception 'project_lead.project_not_found' using errcode = 'P0002';
  end if;

  insert into public.project_leads (project_id, kind, name, phone, email, message, visit_date, visitor_hash)
  values (
    target,
    p_kind,
    btrim(p_name),
    p_phone,
    nullif(btrim(p_email), ''),
    nullif(btrim(p_message), ''),
    case when p_kind = 'site_visit' then p_visit_date end,
    p_visitor_hash
  )
  returning id into lead_id;
  return lead_id;
end;
$$;

revoke execute on function public.submit_project_lead(text, text, text, text, text, text, text, date)
  from public, anon, authenticated;
grant execute on function public.submit_project_lead(text, text, text, text, text, text, text, date)
  to service_role;

-- Records one event and says whether it was recorded. A view is recorded once per visitor per
-- project per hour (BR-71); the same visitor and project are serialised, so two requests at once
-- cannot both pass the check. A project a visitor cannot see records nothing and gives no error.
create function public.track_project_event(
  p_slug text,
  p_event_type text,
  p_visitor_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if p_event_type not in ('view', 'shortlist', 'compare', 'brochure', 'call', 'whatsapp') then
    raise exception 'project_event.type' using errcode = '22023';
  end if;
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{40}$' then
    raise exception 'project_event.visitor' using errcode = '22023';
  end if;

  target := public.public_project_id(p_slug);
  if target is null then
    return false;
  end if;

  if p_event_type = 'view' then
    perform pg_advisory_xact_lock(hashtextextended(target::text || ':' || p_visitor_hash, 0));
    if exists (
      select 1
      from public.project_events
      where project_id = target
        and visitor_hash = p_visitor_hash
        and event_type = 'view'
        and created_at > now() - interval '1 hour'
    ) then
      return false;
    end if;
  end if;

  insert into public.project_events (project_id, event_type, visitor_hash)
  values (target, p_event_type, p_visitor_hash);
  return true;
end;
$$;

revoke execute on function public.track_project_event(text, text, text) from public, anon, authenticated;
grant execute on function public.track_project_event(text, text, text) to service_role;
