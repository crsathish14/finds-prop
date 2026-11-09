-- F04 follow-up: the admin's project moderation (S7-T04, FR-ADM-03).
-- The guard trigger on `projects` lets only the system change the moderation columns (state, published, featured,
-- reason, who and when), the super admin included (BR-40 to BR-43). So the admin's decisions go through one definer
-- function, as for listings (`moderate_listing`): it checks for itself that the caller is a super admin, locks the
-- row, and applies the one change each decision means. The database trigger records the change in the audit log with
-- the admin as the actor. A second function lists every project for the admin's page with the builder's name and the
-- number of leads (a project with leads cannot be deleted, BR-44), which no table read gives in one call.
-- Rollback note: nothing here is destructive. Drop both functions, or fix forward with a new migration.

create function public.moderate_project(p_project uuid, p_action text, p_reason text default null)
returns table (id uuid, slug text, moderation text, published boolean, featured boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  target public.projects%rowtype;
  -- The approved screen asks for no reason, but a rejected project must carry one (the table's own rule).
  reason constant text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Rejected by an admin.');
begin
  if caller is null or not (select public.is_super_admin()) then
    raise exception 'project.not_allowed' using errcode = '42501';
  end if;
  if p_action is null
    or p_action not in ('approve', 'reject', 'publish', 'unpublish', 'feature', 'unfeature')
  then
    raise exception 'project.bad_action' using errcode = '22023';
  end if;
  if char_length(reason) > 500 then
    raise exception 'project.bad_action' using errcode = '22023';
  end if;

  select * into target from public.projects as p where p.id = p_project for update;
  if not found then
    raise exception 'project.not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    -- A pending project is reviewed; a rejected one can be approved later. Whether it is published is not touched.
    if target.moderation not in ('pending', 'rejected') then
      raise exception 'project.not_reviewable' using errcode = '55000';
    end if;
    update public.projects as p
    set moderation = 'approved', rejection_reason = null, moderated_by = caller, moderated_at = now()
    where p.id = p_project;
  elsif p_action = 'reject' then
    if target.moderation <> 'pending' then
      raise exception 'project.not_reviewable' using errcode = '55000';
    end if;
    -- A rejected project is off the site and neither published nor featured.
    update public.projects as p
    set moderation = 'rejected', rejection_reason = reason, published = false, featured = false,
        moderated_by = caller, moderated_at = now()
    where p.id = p_project;
  elsif p_action = 'publish' then
    if target.moderation <> 'approved' or target.published then
      raise exception 'project.not_publishable' using errcode = '55000';
    end if;
    update public.projects as p set published = true where p.id = p_project;
  elsif p_action = 'unpublish' then
    if not target.published then
      raise exception 'project.not_publishable' using errcode = '55000';
    end if;
    update public.projects as p set published = false where p.id = p_project;
  elsif p_action = 'feature' then
    if target.moderation <> 'approved' or target.featured then
      raise exception 'project.not_featurable' using errcode = '55000';
    end if;
    update public.projects as p set featured = true where p.id = p_project;
  else
    if not target.featured then
      raise exception 'project.not_featurable' using errcode = '55000';
    end if;
    update public.projects as p set featured = false where p.id = p_project;
  end if;

  return query
    select p.id, p.slug, p.moderation, p.published, p.featured
    from public.projects as p where p.id = p_project;
end;
$$;

-- Every project, newest first, for the admin's Projects page: with the builder's name, the first picture and how many
-- leads it has. Only the super admin may call it; it checks that itself.
create function public.admin_project_overview()
returns table (
  id uuid,
  name text,
  slug text,
  locality text,
  price_min bigint,
  price_max bigint,
  cover text,
  moderation text,
  published boolean,
  featured boolean,
  builder_id uuid,
  builder_name text,
  leads bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'project.not_allowed' using errcode = '42501';
  end if;
  return query
  select
    project.id,
    project.name,
    project.slug,
    project.locality,
    project.price_min,
    project.price_max,
    project.images[1],
    project.moderation,
    project.published,
    project.featured,
    project.builder_id,
    builder.name,
    (select count(*) from public.project_leads as lead where lead.project_id = project.id),
    project.created_at
  from public.projects as project
  join public.builders as builder on builder.id = project.builder_id
  order by project.created_at desc, project.id;
end;
$$;

revoke execute on function public.moderate_project(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.admin_project_overview() from public, anon, authenticated;
grant execute on function public.moderate_project(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_project_overview() to authenticated, service_role;
