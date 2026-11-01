-- F04 builders: the builder account record and the helper that tells RLS who the builder is.
-- Rules: BR-15, BR-30 to BR-35 (invitation-only builders, isolation, self-update limits, deactivation,
-- reserved admin address cannot become a builder). Builders are never deleted (DEC-28); they are
-- deactivated. Account creation and the email, active and invite columns are written by the
-- service role in the invite flow; a builder edits only their own profile fields.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.builders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null check (char_length(email) between 3 and 254),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  contact_person text check (char_length(contact_person) <= 120),
  phone text check (phone ~ '^\+?[0-9]{6,15}$'),
  logo_url text check (logo_url ~ '^https://[^\s]+$' and char_length(logo_url) <= 500),
  website text check (website ~ '^https://[^\s]+$' and char_length(website) <= 300),
  description text check (char_length(description) <= 2000),
  active boolean not null default true,
  invited_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builders enable row level security;

create unique index builders_email_key on public.builders (lower(email));

-- The reserved admin address is private to the database, so triggers ask this helper instead of
-- calling reserved_admin_email() themselves (BR-35). It only answers yes or no.
create function public.is_reserved_admin_email(candidate text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$ select lower(coalesce(candidate, '')) = public.reserved_admin_email() $$;

-- The active builder record of the signed-in user, when the user also holds the builder role
-- (BR-30, BR-33, BR-34). An inactive builder resolves to nothing and so loses access.
create function public.current_builder_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select builder.id
  from public.builders as builder
  where builder.user_id = (select auth.uid())
    and builder.active
    and public.has_role(builder.user_id, 'builder')
  limit 1
$$;

-- Complete rows for the caller's own record, and for the admin (column grants hide the private
-- columns from everyone else, ADR-017).
create function public.my_builder()
returns setof public.builders
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.builders
  where id = (select public.current_builder_id())
$$;

create function public.admin_builders()
returns setof public.builders
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.builders where (select public.is_super_admin())
$$;

-- BR-32, BR-35: the reserved address never becomes a builder, and only the admin or the system
-- changes the account columns.
create function public.guard_builders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_reserved_admin_email(new.email) then
    raise exception 'builders.reserved_email';
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
    and not (select public.is_super_admin())
    and (new.user_id, new.email, new.active, new.invited_at, new.onboarded_at)
      is distinct from
       (old.user_id, old.email, old.active, old.invited_at, old.onboarded_at)
  then
    raise exception 'builders.admin_only_columns';
  end if;
  return new;
end;
$$;

revoke execute on function public.is_reserved_admin_email(text) from public, anon, authenticated;
revoke execute on function public.current_builder_id() from public, anon, authenticated;
revoke execute on function public.my_builder() from public, anon, authenticated;
revoke execute on function public.admin_builders() from public, anon, authenticated;
revoke execute on function public.guard_builders() from public, anon, authenticated;
grant execute on function public.is_reserved_admin_email(text) to authenticated, service_role;
grant execute on function public.current_builder_id() to authenticated, service_role;
grant execute on function public.my_builder() to authenticated, service_role;
grant execute on function public.admin_builders() to authenticated, service_role;

create trigger builders_guard
  before insert or update on public.builders
  for each row execute function public.guard_builders();

create trigger builders_updated_at
  before update on public.builders
  for each row execute function public.touch_updated_at();

-- Visitors and customers see active builders and only the public profile columns.
revoke all on table public.builders from anon, authenticated;
grant select (id, name, logo_url, website, description) on table public.builders to anon, authenticated;
grant update (name, contact_person, phone, logo_url, website, description)
  on table public.builders to authenticated;

create policy builders_select_public on public.builders
  for select to anon, authenticated
  using (active);

-- The admin sees every builder (public columns here; complete rows through admin_builders()). An
-- update must leave the new row visible to its updater, so without this the admin could not
-- deactivate a builder.
create policy builders_select_admin on public.builders
  for select to authenticated
  using ((select public.is_super_admin()));

create policy builders_update_own on public.builders
  for update to authenticated
  using (id = (select public.current_builder_id()))
  with check (id = (select public.current_builder_id()));

create policy builders_update_admin on public.builders
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
