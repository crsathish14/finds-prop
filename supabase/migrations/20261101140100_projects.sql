-- F04 projects: projects, units and price trends, with the helpers that RLS uses.
-- Rules: BR-40 to BR-49 (moderation, re-approval on a builder edit, public = approved AND published,
-- builder cannot reassign, units never move, RERA), DEC-35 (projects keep exact coordinates).
-- Moderation, publish and feature changes are made only by the system (functions added in a later
-- slice), never by a client. A builder's own edit sends the project back to review (BR-41,
-- owner-confirmed 1 Nov 2026); an admin's edit does not. forms: projects.form_id gets its foreign
-- key in the forms migration.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  name text not null check (char_length(btrim(name)) between 2 and 140),
  builder_id uuid not null default public.current_builder_id()
    references public.builders (id) on delete restrict,

  project_type text check (project_type in ('residential', 'commercial', 'plotted_layout')),
  property_type text check (property_type in ('apartment', 'villa')),
  project_status text check (project_status in ('new_launch', 'under_construction', 'ready_to_move')),
  price_min bigint check (price_min >= 0),
  price_max bigint check (price_max >= 0),
  bhk_options smallint[] not null default '{}'
    check (cardinality(bhk_options) <= 11 and bhk_options <@ array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::smallint[]),
  land_area_acres numeric(8, 2) check (land_area_acres >= 0),
  total_units integer check (total_units >= 0),
  possession_date date,
  contact_phone text check (contact_phone ~ '^\+?[0-9]{6,15}$'),

  locality text not null check (char_length(locality) between 2 and 80),
  address text check (char_length(address) <= 300),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  location extensions.geography(Point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
        then extensions.st_setsrid(extensions.st_makepoint(longitude::float8, latitude::float8), 4326)::extensions.geography
    end
  ) stored,
  advantages text[] not null default '{}' check (cardinality(advantages) <= 20),
  nearby text[] not null default '{}' check (cardinality(nearby) <= 20),

  rera_applicable boolean not null default false,
  rera_number text check (char_length(rera_number) <= 60),
  description text check (char_length(description) <= 5000),
  specifications text check (char_length(specifications) <= 5000),
  amenities text[] not null default '{}' check (cardinality(amenities) <= 30),

  -- Storage paths in the project-media bucket, and video links.
  images text[] not null default '{}' check (cardinality(images) <= 20),
  floor_plans text[] not null default '{}' check (cardinality(floor_plans) <= 20),
  elevations text[] not null default '{}' check (cardinality(elevations) <= 20),
  plot_images text[] not null default '{}' check (cardinality(plot_images) <= 20),
  videos text[] not null default '{}' check (cardinality(videos) <= 5),
  brochure_path text check (char_length(brochure_path) <= 300),
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 300),

  moderation text not null default 'pending'
    check (moderation in ('draft', 'pending', 'approved', 'rejected')),
  published boolean not null default false,
  featured boolean not null default false,
  rejection_reason text check (char_length(rejection_reason) between 1 and 500),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  form_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint projects_price_range check (price_min is null or price_max is null or price_min <= price_max),
  constraint projects_coordinates_together check ((latitude is null) = (longitude is null)),
  constraint projects_rera_number check (rera_number is null or rera_applicable),
  constraint projects_rejection_reason check (moderation <> 'rejected' or rejection_reason is not null)
);

alter table public.projects enable row level security;

-- The public project list (approved and published, featured first) and the builder dashboard.
create index projects_public_list on public.projects (moderation, published, featured);
create index projects_by_builder on public.projects (builder_id, updated_at desc);
-- "Projects near a locality" on the projects page.
create index projects_location on public.projects using gist (location);

create table public.project_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  unit_number text not null check (char_length(btrim(unit_number)) between 1 and 30),
  floor_number smallint check (floor_number between -5 and 200),
  bhk smallint check (bhk between 0 and 10),
  area_sqft numeric(10, 2) check (area_sqft >= 0),
  facing text check (char_length(facing) <= 20),
  price bigint check (price >= 0),
  available_from date,
  floor_plan_path text check (char_length(floor_plan_path) <= 300),
  status text not null default 'available' check (status in ('available', 'hold', 'sold', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, unit_number)
);

alter table public.project_units enable row level security;

-- Monthly price per square foot, shown as a chart; written by the admin only (the builder form in
-- the approved UX has no price trend editor).
create table public.project_price_trends (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  price_per_sqft integer not null check (price_per_sqft between 1 and 10000000),
  created_at timestamptz not null default now(),
  unique (project_id, month)
);

alter table public.project_price_trends enable row level security;

create function public.project_is_live(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = target_project and moderation = 'approved' and published
  )
$$;

create function public.project_is_mine(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = target_project and builder_id = (select public.current_builder_id())
  )
$$;

create function public.my_projects()
returns setof public.projects
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.projects where builder_id = (select public.current_builder_id())
$$;

create function public.admin_projects()
returns setof public.projects
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.projects where (select public.is_super_admin())
$$;

-- BR-40 to BR-43. "System" is the migration, seed and service-role context, which includes the
-- later moderation functions. Everyone else is the builder who owns the project or the admin.
create function public.guard_projects()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_system constant boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
  is_admin boolean := false;
begin
  if not is_system then
    is_admin := (select public.is_super_admin());
  end if;

  if tg_op = 'INSERT' then
    if not is_system and (
      new.moderation <> 'pending'
      or new.published
      or new.featured
      or new.rejection_reason is not null
      or new.moderated_by is not null
      or new.moderated_at is not null
      or (new.form_id is not null and not is_admin)
    ) then
      raise exception 'projects.initial_values';
    end if;
    if not (is_system or is_admin) and new.builder_id is distinct from (select public.current_builder_id()) then
      raise exception 'projects.builder_mismatch';
    end if;
    return new;
  end if;

  if not (is_system or is_admin) then
    if new.builder_id is distinct from old.builder_id then
      raise exception 'projects.builder_immutable';
    end if;
    if new.form_id is distinct from old.form_id then
      raise exception 'projects.form_admin_only';
    end if;
    -- A published address does not move once the project has been moderated.
    if new.slug is distinct from old.slug and old.moderated_at is not null then
      raise exception 'projects.slug_locked';
    end if;
  end if;

  if not is_system and (new.moderation, new.published, new.featured, new.rejection_reason,
      new.moderated_by, new.moderated_at)
    is distinct from
     (old.moderation, old.published, old.featured, old.rejection_reason,
      old.moderated_by, old.moderated_at)
  then
    raise exception 'projects.moderation_system_only';
  end if;

  -- BR-41: a builder's edit sends the project back to review, and hides it until it is approved again.
  if not (is_system or is_admin)
    and (to_jsonb(new) - array['updated_at', 'moderation', 'location', 'rejection_reason'])
      is distinct from
        (to_jsonb(old) - array['updated_at', 'moderation', 'location', 'rejection_reason'])
  then
    new.moderation := 'pending';
    new.rejection_reason := null;
  end if;
  return new;
end;
$$;

-- BR-45: a unit never moves to another project.
create function public.guard_project_units()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'project_units.project_immutable';
  end if;
  return new;
end;
$$;

revoke execute on function public.project_is_live(uuid) from public, anon, authenticated;
revoke execute on function public.project_is_mine(uuid) from public, anon, authenticated;
revoke execute on function public.my_projects() from public, anon, authenticated;
revoke execute on function public.admin_projects() from public, anon, authenticated;
revoke execute on function public.guard_projects() from public, anon, authenticated;
revoke execute on function public.guard_project_units() from public, anon, authenticated;
grant execute on function public.project_is_live(uuid) to anon, authenticated, service_role;
grant execute on function public.project_is_mine(uuid) to authenticated, service_role;
grant execute on function public.my_projects() to authenticated, service_role;
grant execute on function public.admin_projects() to authenticated, service_role;

create trigger projects_guard
  before insert or update on public.projects
  for each row execute function public.guard_projects();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create trigger project_units_guard
  before update on public.project_units
  for each row execute function public.guard_project_units();

create trigger project_units_updated_at
  before update on public.project_units
  for each row execute function public.touch_updated_at();

-- Grants. Public columns only (ADR-017): the moderation columns and the form link stay hidden, and
-- builders read their complete rows through my_projects().
revoke all on table public.projects from anon, authenticated;
revoke all on table public.project_units from anon, authenticated;
revoke all on table public.project_price_trends from anon, authenticated;

grant select (
  id, slug, name, builder_id, project_type, property_type, project_status, price_min, price_max,
  bhk_options, land_area_acres, total_units, possession_date, contact_phone, locality, address,
  latitude, longitude, location, advantages, nearby, rera_applicable, rera_number, description,
  specifications, amenities, images, floor_plans, elevations, plot_images, videos, brochure_path,
  seo_title, seo_description, featured, created_at, updated_at
) on table public.projects to anon, authenticated;
grant insert (
  slug, name, builder_id, project_type, property_type, project_status, price_min, price_max,
  bhk_options, land_area_acres, total_units, possession_date, contact_phone, locality, address,
  latitude, longitude, advantages, nearby, rera_applicable, rera_number, description,
  specifications, amenities, images, floor_plans, elevations, plot_images, videos, brochure_path,
  seo_title, seo_description, form_id
) on table public.projects to authenticated;
grant update (
  slug, name, builder_id, project_type, property_type, project_status, price_min, price_max,
  bhk_options, land_area_acres, total_units, possession_date, contact_phone, locality, address,
  latitude, longitude, advantages, nearby, rera_applicable, rera_number, description,
  specifications, amenities, images, floor_plans, elevations, plot_images, videos, brochure_path,
  seo_title, seo_description, form_id
) on table public.projects to authenticated;
grant delete on table public.projects to authenticated;

grant select on table public.project_units to anon, authenticated;
grant insert (
  project_id, unit_number, floor_number, bhk, area_sqft, facing, price, available_from,
  floor_plan_path, status
) on table public.project_units to authenticated;
grant update (
  unit_number, floor_number, bhk, area_sqft, facing, price, available_from, floor_plan_path, status
) on table public.project_units to authenticated;
grant delete on table public.project_units to authenticated;

grant select on table public.project_price_trends to anon, authenticated;
grant insert (project_id, month, price_per_sqft) on table public.project_price_trends to authenticated;
grant update (price_per_sqft) on table public.project_price_trends to authenticated;
grant delete on table public.project_price_trends to authenticated;

-- Projects: the public sees approved and published rows (BR-42); a builder also sees their own
-- (public columns); the admin sees all. Only the admin deletes, and a project with leads cannot be
-- deleted (BR-44, enforced by the lead foreign key).
create policy projects_select_public on public.projects
  for select to anon
  using (moderation = 'approved' and published);

create policy projects_select_authenticated on public.projects
  for select to authenticated
  using (
    (moderation = 'approved' and published)
    or builder_id = (select public.current_builder_id())
    or (select public.is_super_admin())
  );

create policy projects_insert on public.projects
  for insert to authenticated
  with check (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()));

create policy projects_update on public.projects
  for update to authenticated
  using (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()))
  with check (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()));

create policy projects_delete_admin on public.projects
  for delete to authenticated
  using ((select public.is_super_admin()));

-- Units: public for live projects; the builder manages their own project's units; the admin all.
create policy project_units_select_public on public.project_units
  for select to anon
  using ((select public.project_is_live(project_id)));

create policy project_units_select_authenticated on public.project_units
  for select to authenticated
  using (
    (select public.project_is_live(project_id))
    or (select public.project_is_mine(project_id))
    or (select public.is_super_admin())
  );

create policy project_units_insert on public.project_units
  for insert to authenticated
  with check ((select public.project_is_mine(project_id)) or (select public.is_super_admin()));

create policy project_units_update on public.project_units
  for update to authenticated
  using ((select public.project_is_mine(project_id)) or (select public.is_super_admin()))
  with check ((select public.project_is_mine(project_id)) or (select public.is_super_admin()));

create policy project_units_delete on public.project_units
  for delete to authenticated
  using ((select public.project_is_mine(project_id)) or (select public.is_super_admin()));

-- Price trends: public for live projects, readable by the owning builder, written by the admin.
create policy project_price_trends_select_public on public.project_price_trends
  for select to anon
  using ((select public.project_is_live(project_id)));

create policy project_price_trends_select_authenticated on public.project_price_trends
  for select to authenticated
  using (
    (select public.project_is_live(project_id))
    or (select public.project_is_mine(project_id))
    or (select public.is_super_admin())
  );

create policy project_price_trends_insert_admin on public.project_price_trends
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy project_price_trends_update_admin on public.project_price_trends
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

create policy project_price_trends_delete_admin on public.project_price_trends
  for delete to authenticated
  using ((select public.is_super_admin()));
