-- F06 listings, part 2: listing_media (photo records).
-- Rules: ADR-015 (media), plan 06 6.2 (at most 6 photos, exactly one cover), DEC-09 policy C
-- (changing the photo set of an approved listing sends it back to review).
-- Rows are inserted only by finalize_listing_media() in Stage 6, after the server has checked the
-- real file type and size; owners may reorder captions, set alt text and delete their own photos.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null unique,
  mime text not null check (mime in ('image/webp', 'image/jpeg', 'image/png')),
  bytes integer not null check (bytes > 0 and bytes <= 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  position smallint not null default 0 check (position >= 0),
  is_cover boolean not null default false,
  alt_text text check (char_length(alt_text) <= 200),
  created_at timestamptz not null default now()
);

alter table public.listing_media enable row level security;

-- At most one cover per listing.
create unique index listing_media_one_cover on public.listing_media (listing_id) where is_cover;
create index listing_media_listing on public.listing_media (listing_id, position);

-- At most 6 photos, and the first photo becomes the cover. The parent row is locked so two uploads
-- at once cannot both pass the count.
create function public.listing_media_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.properties where id = new.listing_id for update;
  if (select count(*) from public.listing_media where listing_id = new.listing_id) >= 6 then
    raise exception 'listing_media.limit';
  end if;
  if not exists (select 1 from public.listing_media where listing_id = new.listing_id and is_cover) then
    new.is_cover := true;
  end if;
  return new;
end;
$$;

-- When the cover photo is deleted, the next photo takes over.
create function public.listing_media_promote_cover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_cover then
    update public.listing_media
    set is_cover = true
    where id = (
      select id from public.listing_media
      where listing_id = old.listing_id
      order by position, created_at, id
      limit 1
    );
  end if;
  return null;
end;
$$;

-- Adding or removing a photo changes a moderated field (DEC-09 policy C).
create function public.listing_media_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.properties
  set status = 'pending'
  where id = coalesce(new.listing_id, old.listing_id) and status = 'approved';
  return null;
end;
$$;

revoke execute on function public.listing_media_limits() from public, anon, authenticated;
revoke execute on function public.listing_media_promote_cover() from public, anon, authenticated;
revoke execute on function public.listing_media_review() from public, anon, authenticated;

create trigger listing_media_limits
  before insert on public.listing_media
  for each row execute function public.listing_media_limits();

create trigger listing_media_promote_cover
  after delete on public.listing_media
  for each row execute function public.listing_media_promote_cover();

create trigger listing_media_review
  after insert or delete on public.listing_media
  for each row execute function public.listing_media_review();

revoke all on table public.listing_media from anon, authenticated;
grant select on table public.listing_media to anon, authenticated;
grant update (position, alt_text) on table public.listing_media to authenticated;
grant delete on table public.listing_media to authenticated;

create policy listing_media_select_public on public.listing_media
  for select to anon
  using ((select public.listing_is_public(listing_id)));

create policy listing_media_select_authenticated on public.listing_media
  for select to authenticated
  using (
    (select public.listing_is_public(listing_id))
    or (select public.owns_property(listing_id))
    or (select public.is_super_admin())
  );

create policy listing_media_update_owner on public.listing_media
  for update to authenticated
  using ((select public.listing_is_editable(listing_id)))
  with check ((select public.listing_is_editable(listing_id)));

create policy listing_media_delete_owner on public.listing_media
  for delete to authenticated
  using ((select public.listing_is_editable(listing_id)));

create policy listing_media_delete_admin on public.listing_media
  for delete to authenticated
  using ((select public.is_super_admin()));
