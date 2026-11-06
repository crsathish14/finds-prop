-- F05 forms (S5-T05, part 1): the function that stores a form submission.
-- Rules: BR-60 (the fields were validated against the stored definition by the server before this
-- call), BR-61/70 (the rate limit is counted by the server), BR-63 (a submission with a name and a
-- phone for a project's form is mirrored into project_leads), BR-75 (a visitor is a one-way hash).
-- Submissions have no client write (F05). This function is the only way in, and only the server may
-- call it, so execute is granted to service_role alone.
-- Rollback note: drop the function; nothing else changes. Fix forward with a new migration.

-- Stores one submission and returns its id. The form is named by its slug and must be active and shown
-- somewhere (a placement other than "none"); anything else is P0002, "not found". The project is the
-- form's own project for a form made for one project, or the project page the form was filled in on
-- (named by its slug) for a form shown on every project page; a project a visitor cannot see
-- is ignored, not an error. The fields `name`, `mobile` and `email` have their own columns; everything
-- else is in `data`. The CRM link of the form is copied, and the delivery is marked pending (the
-- delivery itself is Stage 7). A repeat with the same idempotency key returns the first submission and
-- stores nothing more. A submission for an enquiry, brochure or site-visit form that has a project, a
-- name of 2 to 80 characters and a phone of 6 to 15 digits is mirrored into project_leads (a site
-- visit also needs a valid `visit_date` in data); a mirror that cannot be made never stops the
-- submission from being stored.
create function public.record_form_submission(
  p_form_slug text,
  p_visitor_hash text,
  p_name text default null,
  p_mobile text default null,
  p_email text default null,
  p_data jsonb default '{}',
  p_files jsonb default '[]',
  p_source text default null,
  p_project_slug text default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  form_row record;
  target_project uuid;
  submission_id uuid;
  lead_id uuid;
  clean_name text := nullif(btrim(p_name), '');
  visit date;
begin
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{40}$' then
    raise exception 'form.visitor' using errcode = '22023';
  end if;

  select id, name, kind, placement, project_id, crm_integration_id
    into form_row
  from public.forms
  where slug = p_form_slug and active and placement <> 'none';
  if form_row.id is null then
    raise exception 'form.not_found' using errcode = 'P0002';
  end if;

  if form_row.placement = 'project_specific' then
    -- Visible to a visitor: approved, published, and the builder is active (BR-94).
    select project.id into target_project
    from public.projects project
    join public.builders builder on builder.id = project.builder_id
    where project.id = form_row.project_id
      and project.moderation = 'approved'
      and project.published
      and builder.active;
  elsif form_row.placement = 'project' and p_project_slug is not null then
    target_project := public.public_project_id(p_project_slug);
  end if;

  insert into public.form_submissions (
    form_id, form_name, project_id, crm_integration_id, crm_status, name, mobile, email, data, files,
    source, visitor_hash, idempotency_key
  ) values (
    form_row.id,
    form_row.name,
    target_project,
    form_row.crm_integration_id,
    case when form_row.crm_integration_id is null then 'not_applicable' else 'pending' end,
    clean_name,
    nullif(btrim(p_mobile), ''),
    nullif(btrim(p_email), ''),
    coalesce(p_data, '{}'),
    coalesce(p_files, '[]'),
    nullif(btrim(p_source), ''),
    p_visitor_hash,
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into submission_id;

  if submission_id is null then
    select id into submission_id from public.form_submissions where idempotency_key = p_idempotency_key;
    return submission_id;
  end if;

  if target_project is not null
    and form_row.kind in ('enquiry', 'brochure', 'site_visit')
    and clean_name is not null
    and char_length(clean_name) between 2 and 80
    and p_mobile ~ '^[0-9]{6,15}$'
  then
    if form_row.kind = 'site_visit' then
      begin
        visit := (p_data ->> 'visit_date')::date;
      exception when others then
        visit := null;
      end;
    end if;
    if form_row.kind <> 'site_visit' or visit is not null then
      insert into public.project_leads (project_id, kind, name, phone, email, message, visit_date, visitor_hash)
      values (
        target_project,
        form_row.kind,
        clean_name,
        p_mobile,
        nullif(btrim(p_email), ''),
        nullif(left(btrim(coalesce(p_data ->> 'message', '')), 1000), ''),
        visit,
        p_visitor_hash
      )
      returning id into lead_id;
      update public.form_submissions set project_lead_id = lead_id where id = submission_id;
    end if;
  end if;

  return submission_id;
end;
$$;

revoke execute on function public.record_form_submission(text, text, text, text, text, jsonb, jsonb, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_form_submission(text, text, text, text, text, jsonb, jsonb, text, text, uuid)
  to service_role;
