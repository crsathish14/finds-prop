-- F04 follow-up: the admin's list of builders (S7-T05, FR-ADM-04).
-- The Admin Builders screen shows each builder with a status, the number of projects and of leads, and the last
-- sign-in. Projects and leads are read across RLS (an admin may read both), but the last sign-in lives in
-- auth.users, which no client can read, and the statuses depend on it ("Invited" is a builder who has never
-- signed in). One definer function answers all of it, and only for the super admin: it checks that itself, so a
-- mistake in a grant cannot open it. It returns the private builder columns too (email, type, contact), which
-- column grants hide from everyone else (ADR-017), and never anything of the auth user except the time.
-- Rollback note: nothing here is destructive. Drop the function, or fix forward with a new migration.

create function public.admin_builder_overview()
returns table (
  active boolean,
  contact_person text,
  description text,
  email text,
  id uuid,
  invited_at timestamptz,
  kind text,
  last_sign_in_at timestamptz,
  leads bigint,
  logo_url text,
  name text,
  phone text,
  projects bigint,
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
    builder.id,
    builder.invited_at,
    builder.kind,
    account.last_sign_in_at,
    (
      select count(*) from public.project_leads as lead
      join public.projects as project on project.id = lead.project_id
      where project.builder_id = builder.id
    ),
    builder.logo_url,
    builder.name,
    builder.phone,
    (select count(*) from public.projects as project where project.builder_id = builder.id),
    builder.website
  from public.builders as builder
  left join auth.users as account on account.id = builder.user_id
  order by builder.created_at desc, builder.id;
end;
$$;

revoke execute on function public.admin_builder_overview() from public, anon, authenticated;
grant execute on function public.admin_builder_overview() to authenticated, service_role;
