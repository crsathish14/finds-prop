-- F06 media (S6-T01, part 1): the database side of the listing photo pipeline.
-- Rules: ADR-015 (media), plan 06 6.2 (at most 6 photos, exactly one cover), plan 07 section 7
-- (secure uploads), DEC-09 policy C (the photo triggers in 20261101130100 already send an approved
-- listing back to review).
-- A photo gets a row only through finalize_listing_media(), which the server calls after it has read
-- the stored file and checked its real type, size, dimensions and metadata. Nobody else can insert
-- into listing_media (there is no insert grant), and only the server may call the function, so a
-- signed-in user cannot name another user or skip the file checks. The count limit, the cover and
-- the review reset are the existing triggers on listing_media.
-- Rollback note: drop the four functions and unschedule the job (select public.disarm_media_sweep()
-- first); nothing else changes. Fix forward with a new migration.

-- Records one finalized photo and returns its id. The listing must belong to p_owner and still be
-- open to edits (not sold or rented): P0002 otherwise looks the same as a listing that does not
-- exist. The path must be exactly <owner>/<listing>/<uuid>.<extension> for the declared type, and
-- the file must be in the bucket. Calling it again for the same path returns the same row. The
-- seventh photo is refused by the limits trigger ('listing_media.limit').
create function public.finalize_listing_media(
  p_owner uuid,
  p_listing uuid,
  p_path text,
  p_mime text,
  p_bytes integer,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_status text;
  extension_name text;
  media_id uuid;
begin
  select status into listing_status
  from public.properties
  where id = p_listing and owner_id = p_owner;
  if listing_status is null then
    raise exception 'media.listing_not_found' using errcode = 'P0002';
  end if;
  if listing_status not in ('draft', 'pending', 'rejected', 'approved') then
    raise exception 'media.listing_closed' using errcode = '42501';
  end if;

  extension_name := case p_mime
    when 'image/webp' then 'webp'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
  end;
  if extension_name is null
    or p_path !~ (
      '^' || p_owner::text || '/' || p_listing::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' || extension_name || '$'
    )
  then
    raise exception 'media.path' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects where bucket_id = 'listing-photos' and name = p_path
  ) then
    raise exception 'media.object_missing' using errcode = 'P0002';
  end if;

  select id into media_id from public.listing_media where storage_path = p_path;
  if media_id is not null then
    return media_id;
  end if;

  insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height, position)
  values (
    p_listing, p_path, p_mime, p_bytes, p_width, p_height,
    (select coalesce(max(position) + 1, 0) from public.listing_media where listing_id = p_listing)
  )
  returning id into media_id;
  return media_id;
end;
$$;

-- The photo files that nobody claimed: older than p_older_than_hours (24 by default), in the
-- listing-photos bucket, with no listing_media row. They come from an upload that was never
-- finalized, a photo the owner removed, or a listing that was deleted. The sweeper deletes them
-- through the storage service (files cannot be removed by deleting rows in storage.objects).
create function public.orphan_listing_photos(
  p_older_than_hours integer default 24,
  p_limit integer default 500
)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'listing-photos'
    and o.name not like '%.emptyFolderPlaceholder'
    and o.created_at < now() - make_interval(hours => p_older_than_hours)
    and not exists (select 1 from public.listing_media m where m.storage_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000)
$$;

-- Starts the hourly sweep. Same pattern as the CRM retry (20261101140300): the job reads the URL and
-- the token each time it runs, so the token is never copied into the job definition, and scheduling
-- again under the same name replaces it. The owner arms it once per environment (runbook media-sweep).
create function public.arm_media_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.app_config where key = 'app.public_url')
    or not exists (select 1 from public.internal_cron_tokens where name = 'media_sweep')
  then
    raise exception 'media_sweep.not_configured';
  end if;
  perform cron.schedule(
    'media-sweep',
    '17 * * * *',
    $job$
      select net.http_post(
        url := (select value from public.app_config where key = 'app.public_url') || '/api/internal/sweep-media',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', (select token from public.internal_cron_tokens where name = 'media_sweep')
        ),
        body := '{}'::jsonb
      )
    $job$
  );
end;
$$;

create function public.disarm_media_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from cron.job where jobname = 'media-sweep') then
    perform cron.unschedule('media-sweep');
  end if;
end;
$$;

revoke execute on function public.finalize_listing_media(uuid, uuid, text, text, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.orphan_listing_photos(integer, integer) from public, anon, authenticated;
revoke execute on function public.arm_media_sweep() from public, anon, authenticated;
revoke execute on function public.disarm_media_sweep() from public, anon, authenticated;
grant execute on function public.finalize_listing_media(uuid, uuid, text, text, integer, integer, integer)
  to service_role;
grant execute on function public.orphan_listing_photos(integer, integer) to service_role;
grant execute on function public.arm_media_sweep() to service_role;
grant execute on function public.disarm_media_sweep() to service_role;
