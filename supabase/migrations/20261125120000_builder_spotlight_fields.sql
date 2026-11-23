-- Builder spotlight fields (ADR-179, sponsor ads plan PR 1, owner decision 23 Nov 2026).
-- The Developer Spotlight on the home page shows a builder's or an agent's logo, a short tagline, the year they
-- started and how many projects they have delivered. The builder enters these in their own Company profile; the
-- admin can correct the three text fields. All four are optional and public, like the name and description.
-- The logo is a picture the builder uploads to the new public bucket `builder-logos`, under their own folder
-- (`<builder id>/<file>`); only that builder or the super admin can write there. The old `logo_url` column stays as
-- it is (the admin's logo link) and is the fallback when no logo was uploaded.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

alter table public.builders
  add column tagline text check (char_length(btrim(tagline)) between 1 and 100),
  add column established_year smallint check (established_year between 1900 and 2100),
  add column projects_delivered integer check (projects_delivered between 0 and 100000),
  add column logo_path text check (
    char_length(logo_path) <= 200
    and logo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|jpe?g|png)$'
    and split_part(logo_path, '/', 1) = id::text
  );

-- Public like the other profile columns; the builder (own row, by policy) and the admin may change them.
grant select (tagline, established_year, projects_delivered, logo_path) on table public.builders to anon, authenticated;
grant update (tagline, established_year, projects_delivered, logo_path) on table public.builders to authenticated;

-- The logo bucket: public to read, 1 MB, pictures only (never SVG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('builder-logos', 'builder-logos', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A logo path is `<builder id>/<file>`: the caller's own builder record, or any record for the super admin.
create function public.storage_builder_logo_path_ok(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := storage.foldername(object_name);
begin
  if coalesce(array_length(parts, 1), 0) <> 1 then
    return false;
  end if;
  if parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  -- Someone with no builder record has no id to match (NULL), so the answer is a plain no, never NULL.
  return coalesce(parts[1]::uuid = (select public.current_builder_id()), false)
    or coalesce((select public.is_super_admin()), false);
end;
$$;

revoke execute on function public.storage_builder_logo_path_ok(text) from public, anon, authenticated;
grant execute on function public.storage_builder_logo_path_ok(text) to authenticated, service_role;

create policy builder_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'builder-logos' and (select public.storage_builder_logo_path_ok(name)));

create policy builder_logos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'builder-logos' and (select public.storage_builder_logo_path_ok(name)));

create policy builder_logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'builder-logos' and (select public.storage_builder_logo_path_ok(name)))
  with check (bucket_id = 'builder-logos' and (select public.storage_builder_logo_path_ok(name)));

create policy builder_logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'builder-logos' and (select public.storage_builder_logo_path_ok(name)));

-- The admin's Builders table also shows the new fields (same rules as before: super admin only, checked inside).
drop function public.admin_builder_overview();

create function public.admin_builder_overview()
returns table (
  active boolean,
  contact_person text,
  description text,
  email text,
  established_year smallint,
  id uuid,
  invited_at timestamptz,
  kind text,
  last_sign_in_at timestamptz,
  leads bigint,
  logo_path text,
  logo_url text,
  name text,
  phone text,
  projects bigint,
  projects_delivered integer,
  tagline text,
  website text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'builder.not_allowed' using errcode = '42501';
  end if;
  return query
  select
    builder.active,
    builder.contact_person,
    builder.description,
    builder.email,
    builder.established_year,
    builder.id,
    builder.invited_at,
    builder.kind,
    account.last_sign_in_at,
    (
      select count(*) from public.project_leads as lead
      join public.projects as project on project.id = lead.project_id
      where project.builder_id = builder.id
    ),
    builder.logo_path,
    builder.logo_url,
    builder.name,
    builder.phone,
    (select count(*) from public.projects as project where project.builder_id = builder.id),
    builder.projects_delivered,
    builder.tagline,
    builder.website
  from public.builders as builder
  left join auth.users as account on account.id = builder.user_id
  order by builder.created_at desc, builder.id;
end;
$$;

revoke execute on function public.admin_builder_overview() from public, anon, authenticated;
grant execute on function public.admin_builder_overview() to authenticated, service_role;
