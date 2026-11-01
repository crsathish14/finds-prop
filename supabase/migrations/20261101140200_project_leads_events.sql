-- F04 project leads and events.
-- Rules: BR-44 (a project with leads cannot be deleted), BR-46 and BR-47 (a lead stays with its
-- project; a builder changes only the status), BR-31 (builders see only their own).
-- Leads and events are created only by server functions added in the public slice
-- (submit_project_lead, track_project_event), which apply the rate limit; there is no client insert.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.project_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  kind text not null check (kind in ('enquiry', 'site_visit', 'brochure')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{6,15}$'),
  email text check (char_length(email) <= 254),
  message text check (char_length(message) <= 1000),
  visit_date date,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  visitor_hash text check (visitor_hash ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_leads_visit_date check (kind <> 'site_visit' or visit_date is not null)
);

alter table public.project_leads enable row level security;

-- The builder's and admin's lead lists, newest first.
create index project_leads_by_project on public.project_leads (project_id, created_at desc);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  event_type text not null
    check (event_type in ('view', 'shortlist', 'compare', 'brochure', 'call', 'whatsapp')),
  visitor_hash text check (visitor_hash ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now()
);

alter table public.project_events enable row level security;

-- Insights by project and event type over a date range, and the per-visitor view de-dupe.
create index project_events_insights on public.project_events (project_id, event_type, created_at);
create index project_events_by_visitor on public.project_events (project_id, visitor_hash, created_at desc);

-- A lead keeps its project, and only the system or the admin edits more than the status.
create function public.guard_project_leads()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'project_leads.project_immutable';
  end if;
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
    and not (select public.is_super_admin())
    and (new.kind, new.name, new.phone, new.email, new.message, new.visit_date, new.visitor_hash, new.created_at)
      is distinct from
       (old.kind, old.name, old.phone, old.email, old.message, old.visit_date, old.visitor_hash, old.created_at)
  then
    raise exception 'project_leads.immutable_columns';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_project_leads() from public, anon, authenticated;

create trigger project_leads_guard
  before update on public.project_leads
  for each row execute function public.guard_project_leads();

create trigger project_leads_updated_at
  before update on public.project_leads
  for each row execute function public.touch_updated_at();

revoke all on table public.project_leads from anon, authenticated;
revoke all on table public.project_events from anon, authenticated;
grant select on table public.project_leads to authenticated;
grant update (status) on table public.project_leads to authenticated;
grant select on table public.project_events to authenticated;

create policy project_leads_select on public.project_leads
  for select to authenticated
  using ((select public.project_is_mine(project_id)) or (select public.is_super_admin()));

create policy project_leads_update on public.project_leads
  for update to authenticated
  using ((select public.project_is_mine(project_id)) or (select public.is_super_admin()))
  with check ((select public.project_is_mine(project_id)) or (select public.is_super_admin()));

create policy project_events_select on public.project_events
  for select to authenticated
  using ((select public.project_is_mine(project_id)) or (select public.is_super_admin()));
