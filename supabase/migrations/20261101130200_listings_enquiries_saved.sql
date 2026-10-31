-- F06 listings, part 3: enquiries and saved_properties.
-- Rules: BR-50 to BR-54. Enquiries are created only by submit_enquiry() in Stage 5 (it adds the
-- rate limit and the 24 hour de-dupe); there is no client insert.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{6,15}$'),
  email text check (char_length(email) <= 254),
  message text check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;

create index enquiries_by_property on public.enquiries (property_id, created_at desc);
create index enquiries_by_sender on public.enquiries (user_id, created_at desc) where user_id is not null;

-- The listing owner moves an enquiry forward only (BR-52) and changes nothing else.
create function public.guard_enquiries()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
    and (new.property_id, new.user_id, new.name, new.phone, new.email, new.message, new.created_at)
      is distinct from
       (old.property_id, old.user_id, old.name, old.phone, old.email, old.message, old.created_at)
  then
    raise exception 'enquiries.immutable_columns';
  end if;
  if new.status is distinct from old.status then
    if (old.status || '>' || new.status)
      <> all (array['new>contacted', 'new>closed', 'contacted>closed'])
    then
      raise exception 'enquiries.status_transition';
    end if;
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_enquiries() from public, anon, authenticated;

create trigger enquiries_guard
  before update on public.enquiries
  for each row execute function public.guard_enquiries();

revoke all on table public.enquiries from anon, authenticated;
grant select on table public.enquiries to authenticated;
grant update (status) on table public.enquiries to authenticated;

create policy enquiries_select on public.enquiries
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.owns_property(property_id))
    or (select public.is_super_admin())
  );

create policy enquiries_update_owner on public.enquiries
  for update to authenticated
  using ((select public.owns_property(property_id)))
  with check ((select public.owns_property(property_id)));

create table public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.saved_properties enable row level security;

create index saved_properties_by_property on public.saved_properties (property_id);

revoke all on table public.saved_properties from anon, authenticated;
grant select, delete on table public.saved_properties to authenticated;
grant insert (property_id) on table public.saved_properties to authenticated;

create policy saved_properties_select on public.saved_properties
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));

create policy saved_properties_insert on public.saved_properties
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.has_verified_phone())
    and (select public.listing_is_public(property_id))
  );

create policy saved_properties_delete on public.saved_properties
  for delete to authenticated
  using (user_id = (select auth.uid()));
