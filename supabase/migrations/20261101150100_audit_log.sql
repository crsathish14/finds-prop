-- F07 platform, part 2: the audit log (the "history book") and the triggers that write to it.
-- Rules: ADR-028 and plan 06 6.7: moderation, role and builder changes, CRM and CMS changes and
-- destructive deletes are recorded; nobody can edit or delete an entry; only the admin reads them.
-- What an entry may hold: ids, status names and the names of changed columns. Never a phone number,
-- an email address, a message, a secret value or a header value. An IP is stored only as a hash and
-- only by the service (audit_record); the database never sees a raw IP.
-- The request id is read from an `x-request-id` header when the application sends one to Supabase.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null check (actor_role in ('super_admin', 'builder', 'customer', 'system')),
  action text not null
    check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and char_length(action) <= 60),
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id text check (char_length(entity_id) <= 80),
  diff jsonb not null default '{}' check (jsonb_typeof(diff) = 'object'),
  request_id text check (char_length(request_id) <= 80),
  ip_hash text check (char_length(ip_hash) <= 128)
);

alter table public.audit_log enable row level security;

-- The admin's list, newest first, and the history of one record.
create index audit_log_recent on public.audit_log (at desc);
create index audit_log_by_entity on public.audit_log (entity_type, entity_id, at desc);

-- Entries are never edited or removed, by anyone, until a retention rule says otherwise. The
-- trigger stops the service role and the owner too; no client role holds any write privilege.
create function public.audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log.append_only';
end;
$$;

create trigger audit_log_no_change
  before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();

-- Who is acting, as the log records it. The signed-in user's token is still present when a
-- database function runs on their behalf, so a moderation function names the admin.
create function public.audit_actor_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'system'
    when (select public.is_super_admin()) then 'super_admin'
    when (select public.current_builder_id()) is not null then 'builder'
    else 'customer'
  end
$$;

create function public.audit_request_id()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  headers text := current_setting('request.headers', true);
begin
  if headers is null or headers = '' then
    return null;
  end if;
  return left((headers::jsonb) ->> 'x-request-id', 80);
exception when others then
  return null;
end;
$$;

-- The names of the columns whose value changed, never the values.
create function public.changed_columns(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb)
  from jsonb_each(new_row) as entry
  where entry.key <> 'updated_at' and (old_row -> entry.key) is distinct from entry.value
$$;

-- The one writer the triggers use.
create function public.audit_write(action_name text, entity_kind text, entity_key text, change jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, diff, request_id)
  values (
    (select auth.uid()),
    public.audit_actor_role(),
    action_name,
    entity_kind,
    entity_key,
    coalesce(change, '{}'::jsonb),
    public.audit_request_id()
  );
end;
$$;

-- For events no trigger can see, such as a staff sign-in. The service says who acted.
create function public.audit_record(
  actor uuid,
  actor_kind text,
  action_name text,
  entity_kind text,
  entity_key text,
  change jsonb,
  request_key text,
  ip_digest text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, diff, request_id, ip_hash)
  values (actor, actor_kind, action_name, entity_kind, entity_key, coalesce(change, '{}'::jsonb), request_key, ip_digest)
$$;

create function public.audit_properties()
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
      jsonb_build_object('from', old.status, 'to', new.status, 'featured', new.featured)
    );
  end if;
  return null;
end;
$$;

create function public.audit_projects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.audit_write('project.deleted', 'project', old.id::text, jsonb_build_object('moderation', old.moderation));
  else
    perform public.audit_write(
      'project.moderation_changed', 'project', new.id::text,
      jsonb_build_object('from', old.moderation, 'to', new.moderation, 'published', new.published, 'featured', new.featured)
    );
  end if;
  return null;
end;
$$;

-- Every account starts as a customer, so customer roles are not recorded; every other role is.
create function public.audit_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'customer' then
      perform public.audit_write('role.granted', 'user_role', new.user_id::text, jsonb_build_object('role', new.role));
    end if;
  elsif tg_op = 'DELETE' then
    if old.role <> 'customer' then
      perform public.audit_write('role.revoked', 'user_role', old.user_id::text, jsonb_build_object('role', old.role));
    end if;
  elsif new.role is distinct from old.role then
    perform public.audit_write(
      'role.changed', 'user_role', new.user_id::text, jsonb_build_object('from', old.role, 'to', new.role)
    );
  end if;
  return null;
end;
$$;

-- A builder's email address is personal data, so a change is recorded as "changed" only.
create function public.audit_builders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write('builder.created', 'builder', new.id::text, '{}'::jsonb);
    return null;
  end if;
  if new.active is distinct from old.active then
    perform public.audit_write(
      case when new.active then 'builder.activated' else 'builder.deactivated' end,
      'builder', new.id::text, '{}'::jsonb
    );
  end if;
  if lower(new.email) is distinct from lower(old.email) then
    perform public.audit_write('builder.email_changed', 'builder', new.id::text, '{}'::jsonb);
  end if;
  return null;
end;
$$;

create function public.audit_crm_integrations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write('crm.created', 'crm_integration', new.id::text, jsonb_build_object('name', new.name));
  elsif tg_op = 'DELETE' then
    perform public.audit_write('crm.deleted', 'crm_integration', old.id::text, jsonb_build_object('name', old.name));
  else
    perform public.audit_write(
      'crm.updated', 'crm_integration', new.id::text,
      jsonb_build_object('changed', public.changed_columns(to_jsonb(old), to_jsonb(new)))
    );
  end if;
  return null;
end;
$$;

-- Secret changes record which secrets were set or changed, never the values.
create function public.audit_crm_secrets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_columns constant text[] := array['api_key', 'api_secret', 'access_token'];
begin
  if tg_op = 'DELETE' then
    perform public.audit_write('crm.secret_changed', 'crm_integration', old.integration_id::text, jsonb_build_object('removed', true));
  elsif tg_op = 'INSERT' then
    perform public.audit_write(
      'crm.secret_changed', 'crm_integration', new.integration_id::text,
      jsonb_build_object('set', (
        select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb)
        from jsonb_each(to_jsonb(new)) as entry
        where entry.key = any (secret_columns) and entry.value <> 'null'::jsonb
      ))
    );
  else
    perform public.audit_write(
      'crm.secret_changed', 'crm_integration', new.integration_id::text,
      jsonb_build_object('changed', (
        select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb)
        from jsonb_array_elements_text(public.changed_columns(to_jsonb(old), to_jsonb(new))) as entry (key)
        where entry.key = any (secret_columns)
      ))
    );
  end if;
  return null;
end;
$$;

create function public.audit_forms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.audit_write('form.deleted', 'form', old.id::text, jsonb_build_object('name', old.name));
  return null;
end;
$$;

-- A CMS change records which setting changed, not its content.
create function public.audit_site_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.audit_write('cms.changed', 'site_setting', new.key, '{}'::jsonb);
  return null;
end;
$$;

revoke execute on function public.audit_log_append_only() from public, anon, authenticated;
revoke execute on function public.audit_actor_role() from public, anon, authenticated;
revoke execute on function public.audit_request_id() from public, anon, authenticated;
revoke execute on function public.changed_columns(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_write(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_record(uuid, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.audit_properties() from public, anon, authenticated;
revoke execute on function public.audit_projects() from public, anon, authenticated;
revoke execute on function public.audit_user_roles() from public, anon, authenticated;
revoke execute on function public.audit_builders() from public, anon, authenticated;
revoke execute on function public.audit_crm_integrations() from public, anon, authenticated;
revoke execute on function public.audit_crm_secrets() from public, anon, authenticated;
revoke execute on function public.audit_forms() from public, anon, authenticated;
revoke execute on function public.audit_site_settings() from public, anon, authenticated;
grant execute on function public.audit_record(uuid, text, text, text, text, jsonb, text, text) to service_role;

create trigger properties_audit_update
  after update on public.properties
  for each row
  when (old.status is distinct from new.status or old.featured is distinct from new.featured)
  execute function public.audit_properties();

create trigger properties_audit_delete
  after delete on public.properties
  for each row execute function public.audit_properties();

create trigger projects_audit_update
  after update on public.projects
  for each row
  when (
    old.moderation is distinct from new.moderation
    or old.published is distinct from new.published
    or old.featured is distinct from new.featured
  )
  execute function public.audit_projects();

create trigger projects_audit_delete
  after delete on public.projects
  for each row execute function public.audit_projects();

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_user_roles();

create trigger builders_audit
  after insert or update on public.builders
  for each row execute function public.audit_builders();

create trigger crm_integrations_audit
  after insert or update or delete on public.crm_integrations
  for each row execute function public.audit_crm_integrations();

create trigger crm_integration_secrets_audit
  after insert or update or delete on public.crm_integration_secrets
  for each row execute function public.audit_crm_secrets();

create trigger forms_audit
  after delete on public.forms
  for each row execute function public.audit_forms();

create trigger site_settings_audit_insert
  after insert on public.site_settings
  for each row execute function public.audit_site_settings();

create trigger site_settings_audit_update
  after update on public.site_settings
  for each row
  when (old.value is distinct from new.value)
  execute function public.audit_site_settings();

-- Only the admin reads the log; nobody writes it from a client. The service role keeps read access
-- only: it records events through audit_record(), and holds no privilege to change or empty the log.
revoke all on table public.audit_log from anon, authenticated, service_role;
grant select on table public.audit_log to authenticated, service_role;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select public.is_super_admin()));
