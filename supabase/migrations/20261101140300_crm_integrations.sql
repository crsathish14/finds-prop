-- F05 CRM: integrations, their secrets, the retry job token and the retry job.
-- Rules: BR-64 (credentials never reach the browser), BR-65 (https only; the private-address check
-- lives in the application), BR-66 (retry job armed and disarmed as needed), BR-67 (job token).
-- Secrets are plain text in a service-role-only table (owner decision, 1 Nov 2026); Supabase Vault
-- is the later upgrade. Nothing here ever puts a secret in a log or a function result.
-- The retry job reads the public base URL from app_config key `app.public_url` and the token from
-- internal_cron_tokens name `crm_retry`; both are set per environment through the runbook, not here.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.crm_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  lead_source text check (char_length(lead_source) <= 80),
  base_url text not null check (base_url ~ '^https://[^\s/]+[^\s]*$' and char_length(base_url) <= 300),
  endpoint text check (endpoint ~ '^/[^\s]*$' and char_length(endpoint) <= 300),
  method text not null default 'POST' check (method in ('POST', 'PUT')),
  lead_id_path text check (char_length(lead_id_path) <= 120),
  active boolean not null default true,
  headers jsonb not null default '{}' check (jsonb_typeof(headers) = 'object'),
  body_mapping jsonb not null default '{}' check (jsonb_typeof(body_mapping) = 'object'),
  project_codes jsonb not null default '{}' check (jsonb_typeof(project_codes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_integrations enable row level security;

create table public.crm_integration_secrets (
  integration_id uuid primary key references public.crm_integrations (id) on delete cascade,
  api_key text,
  api_secret text,
  access_token text,
  updated_at timestamptz not null default now()
);

alter table public.crm_integration_secrets enable row level security;

create table public.internal_cron_tokens (
  name text primary key check (name ~ '^[a-z][a-z0-9_]*$'),
  token text not null check (char_length(token) >= 32),
  created_at timestamptz not null default now()
);

alter table public.internal_cron_tokens enable row level security;

create trigger crm_integrations_updated_at
  before update on public.crm_integrations
  for each row execute function public.touch_updated_at();

create trigger crm_integration_secrets_updated_at
  before update on public.crm_integration_secrets
  for each row execute function public.touch_updated_at();

-- Starts the once-a-minute retry job. The job reads the URL and token each time it runs, so the
-- token is never copied into the job definition. Scheduling again under the same name replaces it.
create function public.arm_crm_retry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.app_config where key = 'app.public_url')
    or not exists (select 1 from public.internal_cron_tokens where name = 'crm_retry')
  then
    raise exception 'crm_retry.not_configured';
  end if;
  perform cron.schedule(
    'crm-retry',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select value from public.app_config where key = 'app.public_url') || '/api/internal/crm-retry',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', (select token from public.internal_cron_tokens where name = 'crm_retry')
        ),
        body := '{}'::jsonb
      )
    $job$
  );
end;
$$;

create function public.disarm_crm_retry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from cron.job where jobname = 'crm-retry') then
    perform cron.unschedule('crm-retry');
  end if;
end;
$$;

revoke execute on function public.arm_crm_retry() from public, anon, authenticated;
revoke execute on function public.disarm_crm_retry() from public, anon, authenticated;
grant execute on function public.arm_crm_retry() to service_role;
grant execute on function public.disarm_crm_retry() to service_role;

-- Only the admin manages integrations; the secrets and the token are for the service role alone.
revoke all on table public.crm_integrations from anon, authenticated;
revoke all on table public.crm_integration_secrets from anon, authenticated;
revoke all on table public.internal_cron_tokens from anon, authenticated;
grant select, delete on table public.crm_integrations to authenticated;
grant insert (name, lead_source, base_url, endpoint, method, lead_id_path, active, headers, body_mapping, project_codes)
  on table public.crm_integrations to authenticated;
grant update (name, lead_source, base_url, endpoint, method, lead_id_path, active, headers, body_mapping, project_codes)
  on table public.crm_integrations to authenticated;

create policy crm_integrations_select_admin on public.crm_integrations
  for select to authenticated
  using ((select public.is_super_admin()));

create policy crm_integrations_insert_admin on public.crm_integrations
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy crm_integrations_update_admin on public.crm_integrations
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

create policy crm_integrations_delete_admin on public.crm_integrations
  for delete to authenticated
  using ((select public.is_super_admin()));
