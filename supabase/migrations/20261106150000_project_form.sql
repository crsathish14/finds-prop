-- F05 forms (S5-T05, change 4): the form a project page shows, and the project a chosen form belongs to.
-- Rules: BR-49 (the fallback chain is resolved by the application from this function's answer), BR-94
-- (a visitor sees only an approved, published project of an active builder), BR-63 (the mirror into
-- project_leads still applies to a form with a project).
-- projects.form_id is not readable by visitors, so public_project_form() answers for them: it follows the
-- chain and returns only what a visitor may see (never the CRM link). The chain, first match wins:
--   1. the form the admin chose for the project (projects.form_id), when it is active and shown somewhere;
--   2. an active form made for this project alone (placement project_specific);
--   3. an active form shown on every project page (placement project);
-- and none otherwise, so the page falls back to its built-in card. The newest-edited form wins a tie.
-- record_form_submission() below is the same function as before with one more case: a form chosen through
-- projects.form_id may have any placement, so the project named by the page counts when it has chosen
-- this form. Privileges stay as they were (execute for service_role only).
-- Rollback note: nothing destructive. Fix forward: drop function public.public_project_form(text) and
-- restore the earlier body of record_form_submission from 20261106130000.

create function public.public_project_form(p_project_slug text)
returns table (
  slug text,
  name text,
  kind text,
  placement text,
  project_id uuid,
  button_text text,
  success_message text,
  fields jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select project.id, project.form_id
    from public.projects project
    where project.id = public.public_project_id(p_project_slug)
  )
  select form.slug, form.name, form.kind, form.placement, form.project_id, form.button_text,
         form.success_message, form.fields
  from target
  join public.forms form
    on form.active
   and form.placement <> 'none'
   and (form.id = target.form_id or form.project_id = target.id or form.placement = 'project')
  order by
    case when form.id = target.form_id then 0 when form.project_id = target.id then 1 else 2 end,
    form.updated_at desc
  limit 1;
$$;

revoke execute on function public.public_project_form(text) from public;
grant execute on function public.public_project_form(text) to anon, authenticated, service_role;

create or replace function public.record_form_submission(
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
  elsif p_project_slug is not null then
    -- A form the admin chose for one project (projects.form_id) may have any placement: the project
    -- counts only when it has chosen this very form.
    target_project := public.public_project_id(p_project_slug);
    if not exists (
      select 1 from public.projects project
      where project.id = target_project and project.form_id = form_row.id
    ) then
      target_project := null;
    end if;
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
