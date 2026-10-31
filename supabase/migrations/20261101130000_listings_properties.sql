-- F06 listings, part 1: properties, its guard, identity triggers, column grants and policies.
-- Rules: BR-20 to BR-28 (listing lifecycle, moderation, public visibility), DEC-09 policy C (edits to
-- moderated fields send an approved listing back to review), ADR-017 (public projections),
-- DEC-35 (public location is rounded; the exact location and address stay private).
-- Status changes by users happen only through functions added in Stage 6 (submit_listing,
-- set_listing_status, moderate_listing); direct client updates cannot change status.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

-- URL-safe text; used for the listing slug (ADR-025).
create function public.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'), '-')
$$;

create function public.build_property_slug(title text, locality text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(left(public.slugify(coalesce(title, '') || ' ' || coalesce(locality, '')), 80), '-'), ''),
    'property'
  )
$$;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  short_id text not null unique check (short_id ~ '^[a-hjkmnp-z2-9]{8}$'),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  listing_type text check (listing_type in ('sale', 'rent')),
  property_type text check (property_type in ('apartment', 'villa', 'house', 'plot', 'commercial')),
  title text check (char_length(title) between 8 and 140),
  description text check (char_length(description) between 1 and 5000),
  bhk smallint check (bhk between 0 and 10),
  bathrooms smallint check (bathrooms between 0 and 10),
  area_sqft numeric(10, 2) check (area_sqft >= 0),
  price bigint check (price >= 0),
  furnishing text check (furnishing in ('unfurnished', 'semi', 'full')),
  amenities text[] not null default '{}' check (cardinality(amenities) <= 20),
  available_from date,

  address text check (char_length(address) between 1 and 300),
  locality text check (char_length(locality) between 2 and 80),
  city text check (char_length(city) between 1 and 80),
  state text check (char_length(state) between 1 and 80),
  pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  location extensions.geography(Point, 4326),
  -- Rounded to a 0.001 degree grid (about 100 m): the only point anonymous visitors can see (Q1).
  public_location extensions.geography(Point, 4326) generated always as (
    extensions.st_snaptogrid(location::extensions.geometry, 0.001)::extensions.geography
  ) stored,

  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'sold', 'rented')),
  featured boolean not null default false,
  rejection_reason text check (char_length(rejection_reason) between 1 and 500),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Keyword search text. The private address is left out on purpose (Q1). Indexed in F10.
  search_vector tsvector generated always as (
    pg_catalog.to_tsvector(
      'simple'::regconfig,
      coalesce(title, '') || ' ' || coalesce(locality, '') || ' ' || coalesce(city, '')
    )
  ) stored,

  -- Drafts may be incomplete; every other status is complete (Q3).
  constraint properties_complete_unless_draft check (
    status = 'draft' or (
      listing_type is not null and property_type is not null and title is not null
      and description is not null and price is not null and area_sqft is not null
      and locality is not null and city is not null and state is not null
      and pincode is not null and address is not null and location is not null
    )
  ),
  constraint properties_rejection_reason check (status <> 'rejected' or rejection_reason is not null),
  constraint properties_featured_only_approved check (not featured or status = 'approved'),
  constraint properties_no_bhk_for_land check (
    property_type is null or property_type not in ('plot', 'commercial') or bhk is null
  )
);

alter table public.properties enable row level security;

create index properties_owner_dashboard on public.properties (owner_id, status, updated_at desc);
create index properties_admin_queue on public.properties (status, submitted_at);

-- Row access helpers. Policies on other tables cannot read owner_id or status themselves because
-- users hold no column grant on them, so the check lives in these definer functions.
create function public.owns_property(target_property uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.properties
    where id = target_property and owner_id = (select auth.uid())
  )
$$;

create function public.listing_is_public(target_property uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.properties where id = target_property and status = 'approved'
  )
$$;

-- The owner may still change the listing's photos (not sold or rented).
create function public.listing_is_editable(target_property uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.properties
    where id = target_property
      and owner_id = (select auth.uid())
      and status in ('draft', 'pending', 'rejected', 'approved')
  )
$$;

-- Owners and the admin read complete rows through these, since column grants cannot depend on who
-- owns the row (ADR-017).
create function public.my_properties()
returns setof public.properties
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.properties where owner_id = (select auth.uid())
$$;

create function public.admin_properties()
returns setof public.properties
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.properties where (select public.is_super_admin())
$$;

-- Identity: an 8 character short id chosen once, and a slug rebuilt when the title or locality changes.
create function public.properties_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
begin
  if tg_op = 'INSERT' and new.short_id is null then
    loop
      candidate := '';
      for step in 1..8 loop
        candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.properties where short_id = candidate);
    end loop;
    new.short_id := candidate;
  end if;
  if tg_op = 'INSERT' then
    if new.slug is null then
      new.slug := public.build_property_slug(new.title, new.locality);
    end if;
  elsif new.title is distinct from old.title or new.locality is distinct from old.locality then
    new.slug := public.build_property_slug(new.title, new.locality);
  end if;
  return new;
end;
$$;

-- Lifecycle and ownership rules (BR-20 to BR-25, DEC-09 policy C). "System" is the migration, seed
-- and service-role context, which includes the Stage 6 functions; everyone else is a user.
create function public.guard_properties()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_system constant boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if tg_op = 'INSERT' then
    if not is_system and (
      new.owner_id is distinct from (select auth.uid())
      or new.status <> 'draft'
      or new.featured
      or new.rejection_reason is not null
      or new.moderated_by is not null
      or new.moderated_at is not null
      or new.submitted_at is not null
      or new.published_at is not null
      or new.closed_at is not null
    ) then
      raise exception 'properties.initial_values';
    end if;
    if new.status <> 'draft' and new.submitted_at is null then
      new.submitted_at := now();
    end if;
    if new.status in ('approved', 'sold', 'rented') and new.published_at is null then
      new.published_at := now();
    end if;
    if new.status in ('sold', 'rented') and new.closed_at is null then
      new.closed_at := now();
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'properties.owner_immutable';
  end if;
  if new.short_id is distinct from old.short_id then
    raise exception 'properties.short_id_immutable';
  end if;
  if new.status is distinct from old.status
    and (old.status || '>' || new.status) <> all (array[
      'draft>pending', 'pending>approved', 'pending>rejected', 'rejected>pending',
      'approved>pending', 'approved>sold', 'approved>rented'
    ])
  then
    raise exception 'properties.status_transition';
  end if;

  if not is_system then
    if new.status is distinct from old.status then
      raise exception 'properties.status_system_only';
    end if;
    if (new.featured, new.rejection_reason, new.moderated_by, new.moderated_at,
        new.submitted_at, new.published_at, new.closed_at)
      is distinct from
       (old.featured, old.rejection_reason, old.moderated_by, old.moderated_at,
        old.submitted_at, old.published_at, old.closed_at)
    then
      raise exception 'properties.admin_only_columns';
    end if;
    if old.status in ('sold', 'rented') then
      raise exception 'properties.terminal_status';
    end if;
    -- Policy C: changing a moderated field on an approved listing sends it back to review.
    if old.status = 'approved' and (
      (new.title, new.description, new.listing_type, new.property_type, new.address)
        is distinct from (old.title, old.description, old.listing_type, old.property_type, old.address)
      or extensions.st_asbinary(new.location) is distinct from extensions.st_asbinary(old.location)
    ) then
      new.status := 'pending';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending' then
      new.submitted_at := now();
      new.rejection_reason := null;
      new.featured := false;
    elsif new.status = 'approved' then
      new.published_at := coalesce(old.published_at, now());
    elsif new.status in ('sold', 'rented') then
      new.closed_at := now();
      new.featured := false;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.slugify(text) from public, anon, authenticated;
revoke execute on function public.build_property_slug(text, text) from public, anon, authenticated;
revoke execute on function public.owns_property(uuid) from public, anon, authenticated;
revoke execute on function public.listing_is_public(uuid) from public, anon, authenticated;
revoke execute on function public.listing_is_editable(uuid) from public, anon, authenticated;
revoke execute on function public.my_properties() from public, anon, authenticated;
revoke execute on function public.admin_properties() from public, anon, authenticated;
revoke execute on function public.properties_identity() from public, anon, authenticated;
revoke execute on function public.guard_properties() from public, anon, authenticated;
grant execute on function public.listing_is_public(uuid) to anon, authenticated, service_role;
grant execute on function public.owns_property(uuid) to authenticated, service_role;
grant execute on function public.listing_is_editable(uuid) to authenticated, service_role;
grant execute on function public.my_properties() to authenticated, service_role;
grant execute on function public.admin_properties() to authenticated, service_role;

-- Trigger names sort in firing order: the guard first, then identity, then the timestamp.
create trigger properties_guard
  before insert or update on public.properties
  for each row execute function public.guard_properties();

create trigger properties_identity
  before insert or update on public.properties
  for each row execute function public.properties_identity();

create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.touch_updated_at();

-- Grants: the public columns only (ADR-017). Owners write the listing's content columns; status,
-- featured and the moderation columns are never writable by a client, and owner_id is filled in
-- from the session.
revoke all on table public.properties from anon, authenticated;
grant select (
  id, short_id, slug, listing_type, property_type, title, description, bhk, bathrooms, area_sqft,
  price, furnishing, amenities, available_from, locality, city, state, pincode, public_location,
  status, featured, published_at, created_at, updated_at
) on table public.properties to anon, authenticated;
grant insert (
  listing_type, property_type, title, description, bhk, bathrooms, area_sqft, price, furnishing,
  amenities, available_from, address, locality, city, state, pincode, location
) on table public.properties to authenticated;
grant update (
  listing_type, property_type, title, description, bhk, bathrooms, area_sqft, price, furnishing,
  amenities, available_from, address, locality, city, state, pincode, location
) on table public.properties to authenticated;
grant delete on table public.properties to authenticated;

create policy properties_select_public on public.properties
  for select to anon
  using (status = 'approved');

create policy properties_select_authenticated on public.properties
  for select to authenticated
  using (status = 'approved' or owner_id = (select auth.uid()));

create policy properties_select_admin on public.properties
  for select to authenticated
  using ((select public.is_super_admin()));

create policy properties_insert_owner on public.properties
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.has_verified_phone()));

create policy properties_update_owner on public.properties
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy properties_delete_owner on public.properties
  for delete to authenticated
  using (owner_id = (select auth.uid()));
