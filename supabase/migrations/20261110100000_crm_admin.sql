-- F05 follow-up: the admin's CRM connections (S7-T09, FR-ADM-09, ADR-113).
-- The secrets table is closed to everyone but the service role (BR-64), and a write made with the service role is
-- recorded in the audit log as the system, not the admin. So the admin's save goes through one definer function: it
-- checks for itself that the caller is a super admin, writes the connection and any secrets it was given in the same
-- transaction, and the existing audit triggers record both with the admin as the actor (secret names only, never
-- values). A second function lists the connections for the admin's page with, for each secret, only whether it is
-- set, and how many forms send to it. Neither function ever returns a secret.
-- Rollback note: nothing here is destructive. Drop both functions, or fix forward with a new migration.

-- Saves one connection. `p_values` holds the connection's columns (name, lead_source, base_url, endpoint, method,
-- lead_id_path, active, headers, body_mapping, project_codes); the table's own checks apply. `p_integration` is the
-- connection to change, or null for a new one. `p_secrets` holds only the secrets to change: a key with a text value
-- sets that secret, a key with null clears it, a key left out keeps what is stored.
create function public.save_crm_integration(
  p_values jsonb,
  p_integration uuid default null,
  p_secrets jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_names constant text[] := array['api_key', 'api_secret', 'access_token'];
  changes constant jsonb := coalesce(p_secrets, '{}'::jsonb);
  saved uuid;
begin
  if (select auth.uid()) is null or not (select public.is_super_admin()) then
    raise exception 'crm.not_allowed' using errcode = '42501';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' or jsonb_typeof(changes) <> 'object' then
    raise exception 'crm.bad_value' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each(changes) as entry
    where not (entry.key = any (secret_names))
      or jsonb_typeof(entry.value) not in ('string', 'null')
      or (jsonb_typeof(entry.value) = 'string' and char_length(entry.value #>> '{}') not between 1 and 2000)
  ) then
    raise exception 'crm.bad_secret' using errcode = '22023';
  end if;

  if p_integration is null then
    insert into public.crm_integrations (
      name, lead_source, base_url, endpoint, method, lead_id_path, active, headers, body_mapping, project_codes
    )
    values (
      p_values ->> 'name',
      p_values ->> 'lead_source',
      p_values ->> 'base_url',
      p_values ->> 'endpoint',
      coalesce(p_values ->> 'method', 'POST'),
      p_values ->> 'lead_id_path',
      coalesce((p_values ->> 'active')::boolean, true),
      coalesce(p_values -> 'headers', '{}'::jsonb),
      coalesce(p_values -> 'body_mapping', '{}'::jsonb),
      coalesce(p_values -> 'project_codes', '{}'::jsonb)
    )
    returning id into saved;
  else
    update public.crm_integrations as crm
    set
      name = p_values ->> 'name',
      lead_source = p_values ->> 'lead_source',
      base_url = p_values ->> 'base_url',
      endpoint = p_values ->> 'endpoint',
      method = coalesce(p_values ->> 'method', 'POST'),
      lead_id_path = p_values ->> 'lead_id_path',
      active = coalesce((p_values ->> 'active')::boolean, true),
      headers = coalesce(p_values -> 'headers', '{}'::jsonb),
      body_mapping = coalesce(p_values -> 'body_mapping', '{}'::jsonb),
      project_codes = coalesce(p_values -> 'project_codes', '{}'::jsonb)
    where crm.id = p_integration
    returning crm.id into saved;
    if saved is null then
      raise exception 'crm.not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Secrets are written only when something about them changes: a new value, or clearing one that is stored. Clearing
  -- a secret that was never stored writes nothing, so the audit log holds no empty entries.
  if exists (select 1 from jsonb_each(changes) as entry where jsonb_typeof(entry.value) = 'string')
    or (
      changes <> '{}'::jsonb
      and exists (select 1 from public.crm_integration_secrets as stored where stored.integration_id = saved)
    )
  then
    insert into public.crm_integration_secrets as stored (integration_id, api_key, api_secret, access_token)
    values (saved, changes ->> 'api_key', changes ->> 'api_secret', changes ->> 'access_token')
    on conflict (integration_id) do update set
      api_key = case when changes ? 'api_key' then excluded.api_key else stored.api_key end,
      api_secret = case when changes ? 'api_secret' then excluded.api_secret else stored.api_secret end,
      access_token = case when changes ? 'access_token' then excluded.access_token else stored.access_token end;
  end if;

  return saved;
end;
$$;

-- Every connection, by name, for the admin's CRM page: its settings, whether each secret is set (never the secret),
-- and how many forms send to it. Only the super admin may call it; it checks that itself.
create function public.admin_crm_integrations()
returns table (
  id uuid,
  name text,
  lead_source text,
  base_url text,
  endpoint text,
  method text,
  lead_id_path text,
  active boolean,
  headers jsonb,
  body_mapping jsonb,
  project_codes jsonb,
  has_api_key boolean,
  has_api_secret boolean,
  has_access_token boolean,
  forms bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'crm.not_allowed' using errcode = '42501';
  end if;
  return query
  select
    crm.id,
    crm.name,
    crm.lead_source,
    crm.base_url,
    crm.endpoint,
    crm.method,
    crm.lead_id_path,
    crm.active,
    crm.headers,
    crm.body_mapping,
    crm.project_codes,
    coalesce(secret.api_key is not null, false),
    coalesce(secret.api_secret is not null, false),
    coalesce(secret.access_token is not null, false),
    (select count(*) from public.forms as form where form.crm_integration_id = crm.id),
    crm.created_at,
    crm.updated_at
  from public.crm_integrations as crm
  left join public.crm_integration_secrets as secret on secret.integration_id = crm.id
  order by crm.name, crm.id;
end;
$$;

revoke execute on function public.save_crm_integration(jsonb, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_crm_integrations() from public, anon, authenticated;
grant execute on function public.save_crm_integration(jsonb, uuid, jsonb) to authenticated, service_role;
grant execute on function public.admin_crm_integrations() to authenticated, service_role;
