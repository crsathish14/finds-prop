-- F01 base: extensions, the role enum, the updated_at trigger function and app_config.
-- Rules: BR-10, BR-14 (the four roles; `agent` exists with no portal, DEC-08).
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create type public.app_role as enum ('super_admin', 'agent', 'builder', 'customer');

-- Keeps `updated_at` honest on every table that has the column.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Server-side settings that differ per environment and are not secrets (for example the URL the
-- CRM retry job calls, and the listing caps). Only the service role reads or writes it.
create table public.app_config (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]*$'),
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

create trigger app_config_updated_at
  before update on public.app_config
  for each row execute function public.touch_updated_at();
