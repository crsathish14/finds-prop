-- F08 storage: the four buckets, their limits, and who may write where.
-- Rules: R-DB-14, ADR-015, plan 06 section 13 and plan 07 sections 6 and 7.
-- The public buckets have NO select policy for visitors: an image link still works for anyone who
-- has it, but nobody can list a bucket and discover photos of listings that are not approved yet.
-- Owners and the admin get a select policy so uploads and replacements work. The form-uploads bucket
-- has no policy for any user at all; only the server (service role) reads or writes it.
-- The bucket size and type limits are enforced by the storage service; the application still
-- checks the real file type and size when it finalizes an upload, because a file type can be faked.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 10485760, array['image/webp', 'image/jpeg', 'image/png']),
  ('project-media', 'project-media', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),
  ('form-uploads', 'form-uploads', false, 5242880, array[
    'application/pdf', 'image/jpeg', 'image/png', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  -- A hard cap of 500 KB per sponsor banner (DEC-15); never SVG.
  ('site-assets', 'site-assets', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A listing photo is stored at <owner id>/<listing id>/<file>. The uploader must be the owner of
-- that listing, and the listing must still be editable. Malformed paths are simply refused.
create function public.storage_listing_path_ok(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts constant text[] := string_to_array(object_name, '/');
begin
  if coalesce(array_length(parts, 1), 0) < 3 then
    return false;
  end if;
  if parts[1] is distinct from (select auth.uid())::text then
    return false;
  end if;
  if parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.listing_is_editable(parts[2]::uuid);
end;
$$;

-- Project media is stored at <project id>/<file>: the owning builder or the admin.
create function public.storage_project_path_ok(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts constant text[] := string_to_array(object_name, '/');
begin
  if coalesce(array_length(parts, 1), 0) < 2 then
    return false;
  end if;
  if parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.project_is_mine(parts[1]::uuid) or public.is_super_admin();
end;
$$;

revoke execute on function public.storage_listing_path_ok(text) from public, anon, authenticated;
revoke execute on function public.storage_project_path_ok(text) from public, anon, authenticated;
grant execute on function public.storage_listing_path_ok(text) to authenticated, service_role;
grant execute on function public.storage_project_path_ok(text) to authenticated, service_role;

-- listing-photos
create policy listing_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (select public.storage_listing_path_ok(name)));

create policy listing_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_super_admin()))
  );

create policy listing_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'listing-photos' and (select public.storage_listing_path_ok(name)));

create policy listing_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_super_admin()))
  );

-- project-media
create policy project_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-media' and (select public.storage_project_path_ok(name)));

create policy project_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'project-media' and (select public.storage_project_path_ok(name)));

create policy project_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'project-media' and (select public.storage_project_path_ok(name)))
  with check (bucket_id = 'project-media' and (select public.storage_project_path_ok(name)));

create policy project_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-media' and (select public.storage_project_path_ok(name)));

-- site-assets: sponsor banners and other site images, admin only
create policy site_assets_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-assets' and (select public.is_super_admin()));

create policy site_assets_select on storage.objects
  for select to authenticated
  using (bucket_id = 'site-assets' and (select public.is_super_admin()));

create policy site_assets_update on storage.objects
  for update to authenticated
  using (bucket_id = 'site-assets' and (select public.is_super_admin()))
  with check (bucket_id = 'site-assets' and (select public.is_super_admin()));

create policy site_assets_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-assets' and (select public.is_super_admin()));
