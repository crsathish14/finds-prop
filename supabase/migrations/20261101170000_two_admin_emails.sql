-- F02 follow-up: two reserved admin addresses instead of one.
-- Owner decision, 1 Nov 2026: both support@drizzlemarketings.com and developer@findsprop.com are
-- super admins, permanently (no removal before launch). Each is treated exactly as the single
-- address was (BR-11, BR-12, BR-13, BR-35): the role is granted when the address is confirmed,
-- nobody else can hold it, and neither address can become a builder.
-- The list is written here, in a migration, and not kept in a table: a leaked server key must not
-- be able to add an admin. Changing the list takes a reviewed migration (RISK-14). A migration that
-- removes an address must also remove that account's super_admin role.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create function public.reserved_admin_emails()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['support@drizzlemarketings.com', 'developer@findsprop.com']::text[] $$;

revoke execute on function public.reserved_admin_emails() from public, anon, authenticated;

-- The one yes-or-no question every other function asks. It never reveals the list.
create or replace function public.is_reserved_admin_email(candidate text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$ select lower(coalesce(candidate, '')) = any (public.reserved_admin_emails()) $$;

create or replace function public.guard_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'super_admin' and not exists (
    select 1 from auth.users as account
    where account.id = new.user_id
      and public.is_reserved_admin_email(account.email)
      and account.email_confirmed_at is not null
  ) then
    raise exception 'user_roles.super_admin_reserved'
      using hint = 'Only a verified reserved admin account can be super_admin.';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
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
  if public.is_reserved_admin_email(new.email) and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_updated()
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
  if public.is_reserved_admin_email(new.email) and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

-- An account with the new address that already exists and is confirmed gets the role now; the
-- triggers above only act when an account is created or changes.
insert into public.user_roles (user_id, role)
select account.id, 'super_admin'
from auth.users as account
where public.is_reserved_admin_email(account.email) and account.email_confirmed_at is not null
on conflict (user_id, role) do nothing;

-- The single-address function is no longer used by anything.
drop function public.reserved_admin_email();
