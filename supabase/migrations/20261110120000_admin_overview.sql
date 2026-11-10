-- F04 follow-up: the numbers of the admin's Overview page (S7-T06 part 2, FR-ADM-01, ADR-121).
-- One function answers every tile and chart for the super admin, as one JSON object: the stock "as of now" (listings,
-- people), the activity between two days (leads, enquiries, shortlists, visitors, a count for each day, where the leads
-- came from, the projects with the most enquiries) and the newest leads. It runs as the caller (not a definer function),
-- so the row-level policies still apply, and it also refuses anyone who is not the super admin: the policies of
-- `properties`, `project_events` and others let other people read part of the same tables.
-- A lead is a project lead, a property enquiry, or a form submission that belongs to no project (a form on a project
-- page is mirrored into `project_leads`, BR-63, so counting its submission as well would count it twice).
-- Days are whole days in India time (the first day from its first minute, the last day to its last minute), and a
-- range may not be longer than a year. A visitor is counted once however many times they viewed.
-- Rollback note: nothing here is destructive. Drop the function, or fix forward with a new migration.

create function public.admin_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  window_start timestamptz;
  window_end timestamptz;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  today_start timestamptz;
  today_end timestamptz;
  listings jsonb;
  people jsonb;
  activity jsonb;
  daily jsonb;
  top_projects jsonb;
  recent jsonb;
begin
  if not (select public.is_super_admin()) then
    raise exception 'overview.not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'overview.bad_range' using errcode = '22023';
  end if;
  window_start := p_from::timestamp at time zone 'Asia/Kolkata';
  window_end := (p_to + 1)::timestamp at time zone 'Asia/Kolkata';
  today_start := today::timestamp at time zone 'Asia/Kolkata';
  today_end := (today + 1)::timestamp at time zone 'Asia/Kolkata';

  -- The stock, as of now: listings that were submitted (drafts are left out), and people by the role they hold.
  select jsonb_build_object(
    'total', count(*) filter (where property.status <> 'draft'),
    'approved', count(*) filter (where property.status = 'approved'),
    'pending', count(*) filter (where property.status = 'pending')
  ) into listings
  from public.properties as property;

  select jsonb_build_object(
    'customers', count(*) filter (where holder.role = 'customer'),
    'agents', count(*) filter (where holder.role = 'agent'),
    'builders', count(*) filter (where holder.role = 'builder')
  ) into people
  from public.user_roles as holder;

  -- The activity between the two days: every number comes from the same three kinds of lead.
  with found_lead as (
    select 'project'::text as source, (item.kind = 'enquiry') as is_enquiry, item.created_at
    from public.project_leads as item
    where item.created_at >= window_start and item.created_at < window_end
    union all
    select 'property', true, item.created_at
    from public.enquiries as item
    where item.created_at >= window_start and item.created_at < window_end
    union all
    select 'form', false, item.created_at
    from public.form_submissions as item
    where item.project_id is null and item.created_at >= window_start and item.created_at < window_end
  ),
  found_shortlist as (
    select item.created_at
    from public.project_events as item
    where item.event_type = 'shortlist' and item.created_at >= window_start and item.created_at < window_end
    union all
    select item.created_at
    from public.saved_properties as item
    where item.created_at >= window_start and item.created_at < window_end
  )
  select jsonb_build_object(
    'leads', (select count(*) from found_lead),
    'enquiries', (select count(*) from found_lead where is_enquiry),
    'shortlists', (select count(*) from found_shortlist),
    'visitors', (
      select count(distinct event.visitor_hash)
      from public.project_events as event
      where event.event_type = 'view' and event.created_at >= window_start and event.created_at < window_end
    ),
    'new_today', (
      (select count(*) from public.project_leads as item where item.created_at >= today_start and item.created_at < today_end)
      + (select count(*) from public.enquiries as item where item.created_at >= today_start and item.created_at < today_end)
      + (select count(*) from public.form_submissions as item
         where item.project_id is null and item.created_at >= today_start and item.created_at < today_end)
    ),
    'sources', jsonb_build_object(
      'project_pages', (select count(*) from found_lead where source = 'project'),
      'property_enquiries', (select count(*) from found_lead where source = 'property'),
      'other_forms', (select count(*) from found_lead where source = 'form')
    )
  ) into activity;

  -- One entry for each day of the range, in order, with a zero where nothing happened.
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', to_char(series.day, 'YYYY-MM-DD'),
    'leads', coalesce(per_lead.leads, 0),
    'enquiries', coalesce(per_lead.enquiries, 0),
    'shortlists', coalesce(per_shortlist.shortlists, 0)
  ) order by series.day), '[]'::jsonb) into daily
  from (select generate_series(p_from::timestamp, p_to::timestamp, interval '1 day')::date as day) as series
  left join (
    select day, count(*) as leads, count(*) filter (where is_enquiry) as enquiries
    from (
      select (item.created_at at time zone 'Asia/Kolkata')::date as day, (item.kind = 'enquiry') as is_enquiry
      from public.project_leads as item
      where item.created_at >= window_start and item.created_at < window_end
      union all
      select (item.created_at at time zone 'Asia/Kolkata')::date, true
      from public.enquiries as item
      where item.created_at >= window_start and item.created_at < window_end
      union all
      select (item.created_at at time zone 'Asia/Kolkata')::date, false
      from public.form_submissions as item
      where item.project_id is null and item.created_at >= window_start and item.created_at < window_end
    ) as unioned
    group by day
  ) as per_lead on per_lead.day = series.day
  left join (
    select day, count(*) as shortlists
    from (
      select (item.created_at at time zone 'Asia/Kolkata')::date as day
      from public.project_events as item
      where item.event_type = 'shortlist' and item.created_at >= window_start and item.created_at < window_end
      union all
      select (item.created_at at time zone 'Asia/Kolkata')::date
      from public.saved_properties as item
      where item.created_at >= window_start and item.created_at < window_end
    ) as unioned
    group by day
  ) as per_shortlist on per_shortlist.day = series.day;

  -- The six projects with the most enquiries in the range (a project with none is not listed).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', top.id, 'slug', top.slug, 'name', top.name, 'enquiries', top.enquiries
  ) order by top.enquiries desc, top.name, top.id), '[]'::jsonb) into top_projects
  from (
    select project.id, project.slug, project.name, count(*) as enquiries
    from public.project_leads as lead
    join public.projects as project on project.id = lead.project_id
    where lead.kind = 'enquiry' and lead.created_at >= window_start and lead.created_at < window_end
    group by project.id, project.slug, project.name
    order by count(*) desc, project.name, project.id
    limit 6
  ) as top;

  -- The newest five leads whatever the range: a project lead (with its project) or a form with no project.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', newest.id, 'source', newest.source, 'kind', newest.kind, 'name', newest.name,
    'label', newest.label, 'created_at', newest.created_at
  ) order by newest.created_at desc, newest.id desc), '[]'::jsonb) into recent
  from (
    select unioned.*
    from (
      select lead.id, 'project'::text as source, lead.kind, lead.name, project.name as label, lead.created_at
      from public.project_leads as lead
      join public.projects as project on project.id = lead.project_id
      union all
      select submission.id, 'form', null::text, submission.name, submission.form_name, submission.created_at
      from public.form_submissions as submission
      where submission.project_id is null
    ) as unioned
    order by unioned.created_at desc, unioned.id desc
    limit 5
  ) as newest;

  return jsonb_build_object(
    'listings', listings,
    'people', people,
    'leads', activity - 'sources' - 'new_today',
    'new_today', activity -> 'new_today',
    'sources', activity -> 'sources',
    'daily', daily,
    'top_projects', top_projects,
    'recent', recent
  );
end;
$$;

revoke execute on function public.admin_overview(date, date) from public, anon, authenticated;
grant execute on function public.admin_overview(date, date) to authenticated, service_role;
