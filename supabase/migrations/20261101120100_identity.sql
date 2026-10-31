-- F02 identity: profiles, user_roles, role helpers and the triggers on auth.users.
-- Rules: BR-02, BR-03 (profile and default role), BR-11, BR-12, BR-13 (reserved super admin).
-- Rollback note: nothing here is destructive. Fix forward with a new migration. The reserved admin
-- address lives only in reserved_admin_email(); changing it takes a new migration (RISK-14).

-- The one account that may hold super_admin (BR-11). Not a secret, but kept in a single place.
create function public.reserved_admin_email()
returns text
language sql
immutable
set search_path = ''
as $$ select 'support@drizzlemarketings.com'::text $$;

-- Supabase stores phones without the leading plus; profiles keep E.164.
create function public.normalise_phone(raw_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw_phone is null or btrim(raw_phone) = '' then null
    when left(raw_phone, 1) = '+' then raw_phone
    else '+' || raw_phone
  end
$$;

-- A profile mirrors the sign-in identity; users change only their name (see the grants below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 1 and 120),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_phone_key on public.profiles (phone) where phone is not null;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Role helpers. SECURITY DEFINER so policies can read user_roles without opening it up.
create function public.has_role(target_user uuid, target_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = target_user and role = target_role
  )
$$;

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.has_role((select auth.uid()), 'super_admin') $$;

-- True when the session's token carries a phone number, which only OTP sign-in produces. Customer
-- write paths require it so a Google-created account cannot skip the OTP step (plan 06 6.3).
-- Assumes the JWT `phone` claim; spike S3-SPK-01 confirms it.
create function public.has_verified_phone()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce((select auth.jwt()) ->> 'phone', '') <> '' $$;

revoke execute on function public.reserved_admin_email() from public, anon, authenticated;
revoke execute on function public.normalise_phone(text) from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.is_super_admin() from public, anon, authenticated;
revoke execute on function public.has_verified_phone() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.has_verified_phone() to authenticated, service_role;

-- Only the reserved, confirmed account may hold super_admin, however the row arrives (BR-11).
create function public.guard_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'super_admin' and not exists (
    select 1 from auth.users as account
    where account.id = new.user_id
      and lower(account.email) = public.reserved_admin_email()
      and account.email_confirmed_at is not null
  ) then
    raise exception 'user_roles.super_admin_reserved'
      using hint = 'Only the verified reserved admin account can be super_admin.';
  end if;
  return new;
end;
$$;

-- Creates the profile and the customer role for every new account; phone-only accounts have no
-- email (BR-02, BR-03). The reserved admin is also granted super_admin (BR-12).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email_verified_at)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    public.normalise_phone(new.phone),
    new.email_confirmed_at
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  if lower(new.email) = public.reserved_admin_email() and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end;
$$;

-- Keeps the profile mirror in step with the sign-in identity, and grants super_admin when the
-- reserved address is confirmed later (BR-12).
create function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = public.normalise_phone(new.phone),
      email_verified_at = new.email_confirmed_at
  where id = new.id;
  if lower(new.email) = public.reserved_admin_email() and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_user_roles() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;

create trigger user_roles_guard
  before insert or update on public.user_roles
  for each row execute function public.guard_user_roles();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_updated
  after update on auth.users
  for each row
  when (
    old.email is distinct from new.email
    or old.email_confirmed_at is distinct from new.email_confirmed_at
    or old.phone is distinct from new.phone
  )
  execute function public.handle_user_updated();

-- Grants and policies. Profiles are created by the trigger, never by a client; a user may change
-- only their own name. Roles are managed by the super admin, and never the super_admin role (BR-13).
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select, insert, delete on table public.user_roles to authenticated;
grant update (role) on table public.user_roles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select public.is_super_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));

create policy user_roles_insert_admin on public.user_roles
  for insert to authenticated
  with check ((select public.is_super_admin()) and role <> 'super_admin');

create policy user_roles_update_admin on public.user_roles
  for update to authenticated
  using ((select public.is_super_admin()) and role <> 'super_admin')
  with check ((select public.is_super_admin()) and role <> 'super_admin');

create policy user_roles_delete_admin on public.user_roles
  for delete to authenticated
  using ((select public.is_super_admin()) and role <> 'super_admin');
