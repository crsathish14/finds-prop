-- F04 follow-up: the numbers of the builder's Dashboard and Insights pages (S7-T03 step E, FR-BLD-06).
-- One function answers every tile for the signed-in builder: their projects and units (the portfolio), and the
-- visitor activity and the actions taken on their projects between two days. It runs as the caller (not a definer
-- function), so the row-level policies of the tables still apply, and it also restricts every count to the projects
-- of the builder's own record: the policies of `project_units` let any signed-in person read the units of a live
-- project, and a super admin may read every project, so the policies alone are not "my projects". Anyone who is
-- not an active builder is refused. A project that is not the builder's, asked for by id, counts as no project.
-- Days are whole days in India time (the first day from its first minute, the last day to its last minute), and a
-- range may not be longer than a year. A visitor is counted once however many times they viewed.
-- Rollback note: nothing here is destructive. Drop the function, or fix forward with a new migration.

create function public.builder_insights(
  p_from date,
  p_to date,
  p_project uuid default null
)
returns table (
  projects bigint,
  active_projects bigint,
  total_units bigint,
  available_units bigint,
  sold_units bigint,
  views bigint,
  visitors bigint,
  shortlists bigint,
  comparisons bigint,
  brochures bigint,
  calls bigint,
  whatsapp bigint,
  enquiries bigint,
  leads bigint,
  site_visits bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  own_builder uuid := (select public.current_builder_id());
  own_projects uuid[];
  window_start timestamptz;
  window_end timestamptz;
begin
  if own_builder is null then
    raise exception 'insights.not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'insights.bad_range' using errcode = '22023';
  end if;
  window_start := p_from::timestamp at time zone 'Asia/Kolkata';
  window_end := (p_to + 1)::timestamp at time zone 'Asia/Kolkata';

  select coalesce(array_agg(project.id), '{}') into own_projects
  from public.projects as project
  where project.builder_id = own_builder
    and (p_project is null or project.id = p_project);

  return query
  select
    portfolio.projects,
    portfolio.active_projects,
    stock.total_units,
    stock.available_units,
    stock.sold_units,
    activity.views,
    activity.visitors,
    activity.shortlists,
    activity.comparisons,
    activity.brochures,
    activity.calls,
    activity.whatsapp,
    response.enquiries,
    response.leads,
    response.site_visits
  from (
    select
      count(*) as projects,
      count(*) filter (where project.moderation = 'approved' and project.published) as active_projects
    from public.projects as project
    where project.id = any (own_projects)
  ) as portfolio
  cross join (
    select
      count(*) as total_units,
      count(*) filter (where unit.status = 'available') as available_units,
      count(*) filter (where unit.status = 'sold') as sold_units
    from public.project_units as unit
    where unit.project_id = any (own_projects)
  ) as stock
  cross join (
    select
      count(*) filter (where event.event_type = 'view') as views,
      count(distinct event.visitor_hash) filter (where event.event_type = 'view') as visitors,
      count(*) filter (where event.event_type = 'shortlist') as shortlists,
      count(*) filter (where event.event_type = 'compare') as comparisons,
      count(*) filter (where event.event_type = 'brochure') as brochures,
      count(*) filter (where event.event_type = 'call') as calls,
      count(*) filter (where event.event_type = 'whatsapp') as whatsapp
    from public.project_events as event
    where event.project_id = any (own_projects)
      and event.created_at >= window_start
      and event.created_at < window_end
  ) as activity
  cross join (
    select
      count(*) filter (where lead.kind = 'enquiry') as enquiries,
      count(*) as leads,
      count(*) filter (where lead.kind = 'site_visit') as site_visits
    from public.project_leads as lead
    where lead.project_id = any (own_projects)
      and lead.created_at >= window_start
      and lead.created_at < window_end
  ) as response;
end;
$$;

revoke execute on function public.builder_insights(date, date, uuid) from public, anon, authenticated;
grant execute on function public.builder_insights(date, date, uuid) to authenticated, service_role;
