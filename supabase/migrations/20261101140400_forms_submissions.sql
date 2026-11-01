-- F05 forms: dynamic forms, their submissions and the CRM delivery log.
-- Rules: BR-49 (project form, with a fallback chain resolved in the application), BR-60 to BR-63
-- (server-side field validation, limits, mirroring into project_leads), BR-64 (no credentials).
-- Past submissions and delivery history are kept when a form or a CRM connection is deleted (the
-- approved UX promises this), so those links are SET NULL and the names are copied at write time.
-- Submissions and log rows are written by server functions and the service role; there is no
-- client write. Field values are validated against the stored field list before the insert.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  kind text not null
    check (kind in ('enquiry', 'site_visit', 'brochure', 'callback', 'contact', 'whatsapp')),
  placement text not null default 'none'
    check (placement in ('none', 'project', 'project_specific', 'contact')),
  project_id uuid references public.projects (id) on delete set null,
  crm_integration_id uuid references public.crm_integrations (id) on delete set null,
  button_text text check (char_length(button_text) <= 40),
  success_message text check (char_length(success_message) <= 300),
  -- A list of { label, key, type, placeholder, options, min, max, required }; the shape is checked
  -- by the application schema, the database keeps it a bounded list.
  fields jsonb not null default '[]'
    check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forms_project_only_when_specific check (project_id is null or placement = 'project_specific')
);

alter table public.forms enable row level security;

-- The foreign key from a project to its chosen form, and the lookups that deleting a project or a
-- form runs.
alter table public.projects
  add constraint projects_form_id_fkey foreign key (form_id) references public.forms (id) on delete set null;
create index projects_by_form on public.projects (form_id) where form_id is not null;
create index forms_by_project on public.forms (project_id) where project_id is not null;

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.forms (id) on delete set null,
  form_name text not null check (char_length(form_name) <= 120),
  project_id uuid references public.projects (id) on delete set null,
  project_lead_id uuid references public.project_leads (id) on delete set null,
  crm_integration_id uuid references public.crm_integrations (id) on delete set null,
  name text check (char_length(name) <= 120),
  mobile text check (mobile ~ '^[0-9]{6,15}$'),
  email text check (char_length(email) <= 254),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  -- Storage paths in the private form-uploads bucket (BR-62: at most 3 files).
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 3),
  source text check (char_length(source) <= 200),
  crm_status text not null default 'not_applicable'
    check (crm_status in ('not_applicable', 'pending', 'success', 'failed')),
  crm_lead_id text check (char_length(crm_lead_id) <= 120),
  crm_http_status smallint,
  crm_attempts smallint not null default 0 check (crm_attempts between 0 and 6),
  next_retry_at timestamptz,
  last_error text check (char_length(last_error) <= 500),
  visitor_hash text check (visitor_hash ~ '^[0-9a-f]{40}$'),
  idempotency_key uuid unique,
  created_at timestamptz not null default now()
);

alter table public.form_submissions enable row level security;

-- The admin submissions list (newest first, filtered by form), the retry sweep, and the lookups
-- that deleting a project or a CRM connection runs.
create index form_submissions_recent on public.form_submissions (created_at desc);
create index form_submissions_by_form on public.form_submissions (form_id, created_at desc);
create index form_submissions_retry on public.form_submissions (next_retry_at)
  where crm_status = 'failed' and next_retry_at is not null;
create index form_submissions_by_project on public.form_submissions (project_id) where project_id is not null;
create index form_submissions_by_crm on public.form_submissions (crm_integration_id)
  where crm_integration_id is not null;

create table public.crm_api_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.crm_integrations (id) on delete set null,
  integration_name text not null check (char_length(integration_name) <= 120),
  submission_id uuid references public.form_submissions (id) on delete set null,
  form_name text check (char_length(form_name) <= 120),
  outcome text not null check (outcome in ('success', 'failed')),
  http_status smallint,
  attempt smallint not null default 1 check (attempt between 1 and 6),
  response_snippet text check (char_length(response_snippet) <= 500),
  created_at timestamptz not null default now()
);

alter table public.crm_api_logs enable row level security;

-- The delivery log, newest first, and the attempts of one submission.
create index crm_api_logs_recent on public.crm_api_logs (created_at desc);
create index crm_api_logs_by_submission on public.crm_api_logs (submission_id) where submission_id is not null;

create trigger forms_updated_at
  before update on public.forms
  for each row execute function public.touch_updated_at();

-- The admin reads and edits forms, including the CRM link; everyone else sees active forms and
-- never the CRM link (a column grant), so the editor reads complete rows through admin_forms().
create function public.admin_forms()
returns setof public.forms
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.forms where (select public.is_super_admin())
$$;

revoke execute on function public.admin_forms() from public, anon, authenticated;
grant execute on function public.admin_forms() to authenticated, service_role;

revoke all on table public.forms from anon, authenticated;
revoke all on table public.form_submissions from anon, authenticated;
revoke all on table public.crm_api_logs from anon, authenticated;

grant select (id, name, slug, kind, placement, project_id, button_text, success_message, fields, active, created_at, updated_at)
  on table public.forms to anon, authenticated;
grant insert (name, slug, kind, placement, project_id, crm_integration_id, button_text, success_message, fields, active)
  on table public.forms to authenticated;
grant update (name, slug, kind, placement, project_id, crm_integration_id, button_text, success_message, fields, active)
  on table public.forms to authenticated;
grant delete on table public.forms to authenticated;
grant select on table public.form_submissions to authenticated;
grant select on table public.crm_api_logs to authenticated;

create policy forms_select_active on public.forms
  for select to anon, authenticated
  using (active);

create policy forms_select_admin on public.forms
  for select to authenticated
  using ((select public.is_super_admin()));

create policy forms_insert_admin on public.forms
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy forms_update_admin on public.forms
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

create policy forms_delete_admin on public.forms
  for delete to authenticated
  using ((select public.is_super_admin()));

create policy form_submissions_select_admin on public.form_submissions
  for select to authenticated
  using ((select public.is_super_admin()));

create policy crm_api_logs_select_admin on public.crm_api_logs
  for select to authenticated
  using ((select public.is_super_admin()));
