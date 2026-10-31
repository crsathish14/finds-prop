-- F03 site_settings: the CMS key and JSON value store.
-- Rules: BR-80, BR-81, BR-82 (settings keys; defaults are merged in code).
-- Public by design: anyone can read it, so never store anything private here.
-- Writes are limited to the super admin. The second-factor (aal2) condition arrives in a later
-- migration once spike S3-SPK-01 settles DEC-05.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

create trigger site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

create policy site_settings_select on public.site_settings
  for select to anon, authenticated
  using (true);

create policy site_settings_insert_admin on public.site_settings
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy site_settings_update_admin on public.site_settings
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
