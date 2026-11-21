-- ADR-143 phase 4: the Careers module's job postings, and the search over them.
-- Rules: ADR-143 sections 3 and 4 (a job is open until it is closed or its closing date passes, soft delete, who may
-- read and write), ADR-147 (the job's fields, plain text and the apply link), ADR-017 (the public columns are named),
-- plan 07 section 5 (a visitor reads what is visible; only the super admin writes).
-- A visitor (anon or a signed-in customer) reads a job only when it is open, its closing date is empty or still ahead,
-- and it is not in Trash; the super admin reads them all. The test is in the row policy, so the pages, the sitemap and
-- the AI tools see the same rows, and an expired job disappears with no scheduled job. A draft, a closed job and a
-- trashed one are never visible to anyone else, whatever the application does.
-- Delete is soft: Trash sets `deleted_at` (the nightly retention job removes old ones later, not here). A check makes
-- "open and in Trash" impossible, so restoring never reopens a job by itself. No client holds the DELETE privilege.
-- People apply on another site or by email (exactly one of `apply_url` and `apply_email`); the platform stores no
-- applicant data (ADR-143 D4). The link must be https.
-- Every change is recorded as `content.changed` by a trigger (the id, the module and the names of the changed
-- columns, never the text), like the categories, the questions and the articles.
-- Rollback note: nothing here is destructive (a new table, a function and triggers). Fix forward with a new migration.

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  -- The address of the job, /careers/<slug>: made from the title, editable, unique.
  slug text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 120),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  -- The department must be a `department` category (a trigger checks it); a department with jobs cannot be deleted,
  -- even when the jobs are in Trash.
  department_id uuid not null references public.content_categories (id) on delete restrict,
  location text not null check (char_length(btrim(location)) between 2 and 120),
  work_mode text not null check (work_mode in ('onsite', 'hybrid', 'remote')),
  employment_type text not null
    check (employment_type in ('full_time', 'part_time', 'contract', 'internship')),
  -- Free text such as "2 to 4 years"; empty when the job does not say.
  experience text not null default '' check (char_length(experience) <= 80),
  -- Plain text. A blank line starts a new paragraph in the description; the responsibilities and the requirements
  -- hold one point per line. The page draws them as text, never as HTML.
  summary text not null default '' check (char_length(summary) <= 320),
  description text not null default '' check (char_length(description) <= 8000),
  responsibilities text not null default '' check (char_length(responsibilities) <= 4000),
  requirements text not null default '' check (char_length(requirements) <= 4000),
  salary_note text check (salary_note is null or char_length(btrim(salary_note)) between 1 and 120),
  -- Exactly one way to apply: an https address, or an email address.
  apply_url text
    check (apply_url ~ '^https://[^\s/?#@]+([/?#][^\s]*)?$' and char_length(apply_url) <= 500),
  apply_email text
    check (apply_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(apply_email) <= 254),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  -- The last moment people may apply; empty means "until the admin closes it". After it the job is no longer visible.
  closes_at timestamptz,
  -- Set by a trigger the first time the job is opened, and kept when it is closed and opened again (structured data
  -- needs the date the job was posted).
  posted_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The 'english' configuration, like the FAQ: the text is English prose, so "engineer" and "engineers" find each
  -- other. The title weighs the most, then the summary and the place, then the long text. The configuration is named
  -- in full so the generated column is immutable.
  search_vector tsvector generated always as (
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, title), 'A')
    || pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, summary || ' ' || location), 'B')
    || pg_catalog.setweight(
      pg_catalog.to_tsvector('english'::regconfig, description || ' ' || responsibilities || ' ' || requirements),
      'C'
    )
  ) stored,

  constraint job_postings_slug_key unique (slug),
  constraint job_postings_one_way_to_apply check (num_nonnulls(apply_url, apply_email) = 1),
  -- An open job is complete.
  constraint job_postings_open_is_complete check (
    status <> 'open' or (
      posted_at is not null
      and char_length(btrim(summary)) >= 1
      and char_length(btrim(description)) >= 1
      and char_length(btrim(requirements)) >= 1
    )
  ),
  -- A trashed job is not open: restoring it never puts it back on the site by itself.
  constraint job_postings_trash_is_not_open check (deleted_at is null or status <> 'open')
);

alter table public.job_postings enable row level security;

-- The public list, newest first, and the keyword search: open jobs that are not in Trash (the closing date is tested
-- when the rows are read, because "now" cannot be in an index).
create index job_postings_open on public.job_postings (posted_at desc, id)
  where status = 'open' and deleted_at is null;
create index job_postings_search on public.job_postings using gin (search_vector)
  where status = 'open' and deleted_at is null;
-- The department filter and the foreign key's delete check.
create index job_postings_by_department on public.job_postings (department_id);
-- The admin's list: Trash apart, newest edit first.
create index job_postings_admin_list on public.job_postings (deleted_at, updated_at desc);

-- The columns are named (ADR-017), the same for a visitor and a signed-in person. The apply address is public on
-- purpose: it is what the Apply button opens. The status, the Trash date and the creation date tell a visitor
-- nothing: the row policy lets them see only open jobs that have no Trash date.
revoke all on table public.job_postings from anon, authenticated;
grant select (
  id, slug, title, department_id, location, work_mode, employment_type, experience, summary, description,
  responsibilities, requirements, salary_note, apply_url, apply_email, status, closes_at, posted_at, search_vector,
  deleted_at, created_at, updated_at
) on table public.job_postings to anon, authenticated;
-- Nobody writes the id, the dates or the search vector; the posted date is the trigger's.
grant insert (
  slug, title, department_id, location, work_mode, employment_type, experience, summary, description,
  responsibilities, requirements, salary_note, apply_url, apply_email, status, closes_at
) on table public.job_postings to authenticated;
grant update (
  slug, title, department_id, location, work_mode, employment_type, experience, summary, description,
  responsibilities, requirements, salary_note, apply_url, apply_email, status, closes_at, deleted_at
) on table public.job_postings to authenticated;

create trigger job_postings_updated_at
  before update on public.job_postings
  for each row execute function public.touch_updated_at();

-- Two policies, because a visitor (anon) may not call is_super_admin().
create policy job_postings_select_public on public.job_postings
  for select to anon
  using (status = 'open' and deleted_at is null and (closes_at is null or closes_at > now()));

create policy job_postings_select_signed_in on public.job_postings
  for select to authenticated
  using (
    (status = 'open' and deleted_at is null and (closes_at is null or closes_at > now()))
    or (select public.is_super_admin())
  );

create policy job_postings_insert_admin on public.job_postings
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy job_postings_update_admin on public.job_postings
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- Before every write: the department must be a `department` category, and the first opening stamps the date. The
-- check runs with its own rights so a refusal is the same whatever the caller can see; a category that does not exist
-- is left to the foreign key.
create function public.job_postings_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_module text;
begin
  if tg_op = 'INSERT' or new.department_id is distinct from old.department_id then
    select category.module into category_module
    from public.content_categories as category
    where category.id = new.department_id;
    if category_module is not null and category_module <> 'department' then
      raise exception 'a job belongs to a department category' using errcode = '23514';
    end if;
  end if;
  if new.status = 'open' and new.posted_at is null then
    new.posted_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.job_postings_prepare() from public, anon, authenticated;

create trigger job_postings_prepare
  before insert or update on public.job_postings
  for each row execute function public.job_postings_prepare();

-- The audit entry: which job and what kind of change, never its text.
create function public.audit_job_postings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived constant text[] := array['search_vector'];
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(
      'content.changed', 'job_posting', new.id::text,
      jsonb_build_object('change', 'created', 'module', 'careers')
    );
  else
    perform public.audit_write(
      'content.changed', 'job_posting', new.id::text,
      jsonb_build_object(
        'change', 'updated', 'module', 'careers',
        'columns', (
          select coalesce(jsonb_agg(entry.name order by entry.name), '[]'::jsonb)
          from jsonb_array_elements_text(public.changed_columns(to_jsonb(old), to_jsonb(new))) as entry (name)
          where entry.name <> all (derived)
        )
      )
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_job_postings() from public, anon, authenticated;

create trigger job_postings_audit_insert
  after insert on public.job_postings
  for each row execute function public.audit_job_postings();

-- A save that changes nothing is not recorded (updated_at alone does not count).
create trigger job_postings_audit_update
  after update on public.job_postings
  for each row
  when ((
    old.slug, old.title, old.department_id, old.location, old.work_mode, old.employment_type, old.experience,
    old.summary, old.description, old.responsibilities, old.requirements, old.salary_note, old.apply_url,
    old.apply_email, old.status, old.closes_at, old.posted_at, old.deleted_at
  ) is distinct from (
    new.slug, new.title, new.department_id, new.location, new.work_mode, new.employment_type, new.experience,
    new.summary, new.description, new.responsibilities, new.requirements, new.salary_note, new.apply_url,
    new.apply_email, new.status, new.closes_at, new.posted_at, new.deleted_at
  ))
  execute function public.audit_job_postings();

-- The visitor-facing search (ADR-143 section 3). Runs as the caller (SECURITY INVOKER), so it reads only what the row
-- policy and the column grants allow: open jobs that have not closed and are not in Trash (the function says so too, so the
-- super admin's call returns the same list a visitor sees). Every argument is optional.
-- `p_query` is read as plain words (quotes, "or" and "-" work); `p_department` is a department slug; `p_location` is a
-- place as typed in the job (any case); `p_work_mode` and `p_type` are the stored values. With words, the best match
-- comes first and `snippet` is a short passage around the matches, the matched words between [[ and ]]; without, the
-- newest comes first and the snippet is the summary. `total_count` is the number of matches before the page limit, on
-- every row. Explicit columns only; never the long text, which the job page reads.
create function public.search_job_postings(
  p_query text default null,
  p_department text default null,
  p_location text default null,
  p_work_mode text default null,
  p_type text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  department_id uuid,
  department_slug text,
  department_name text,
  location text,
  work_mode text,
  employment_type text,
  experience text,
  summary text,
  snippet text,
  salary_note text,
  closes_at timestamptz,
  posted_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  words text := nullif(btrim(left(coalesce(p_query, ''), 200)), '');
  search_query pg_catalog.tsquery;
  department_filter text := nullif(btrim(lower(coalesce(p_department, ''))), '');
  location_filter text := nullif(btrim(lower(coalesce(p_location, ''))), '');
  mode_filter text := nullif(btrim(lower(coalesce(p_work_mode, ''))), '');
  type_filter text := nullif(btrim(lower(coalesce(p_type, ''))), '');
  page_size integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  page_start integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
begin
  if words is not null then
    search_query := pg_catalog.websearch_to_tsquery('english'::regconfig, words);
  end if;
  return query
    select
      job.id,
      job.slug,
      job.title,
      job.department_id,
      department.slug,
      department.name,
      job.location,
      job.work_mode,
      job.employment_type,
      job.experience,
      job.summary,
      case
        when search_query is null then job.summary
        else pg_catalog.ts_headline(
          'english'::regconfig,
          job.summary || ' ' || job.description || ' ' || job.responsibilities || ' ' || job.requirements,
          search_query,
          'StartSel="[[", StopSel="]]", MaxWords=40, MinWords=15, ShortWord=2, MaxFragments=1'
        )
      end,
      job.salary_note,
      job.closes_at,
      job.posted_at,
      count(*) over ()
    from public.job_postings as job
    left join public.content_categories as department on department.id = job.department_id
    where job.status = 'open'
      and job.deleted_at is null
      and (job.closes_at is null or job.closes_at > now())
      and (search_query is null or job.search_vector @@ search_query)
      and (department_filter is null or department.slug = department_filter)
      and (location_filter is null or lower(job.location) = location_filter)
      and (mode_filter is null or job.work_mode = mode_filter)
      and (type_filter is null or job.employment_type = type_filter)
    order by
      case when search_query is null then 0
        else pg_catalog.ts_rank(job.search_vector, search_query) end desc,
      job.posted_at desc,
      job.id
    limit page_size
    offset page_start;
end;
$$;

revoke execute on function public.search_job_postings(text, text, text, text, text, integer, integer) from public;
grant execute on function public.search_job_postings(text, text, text, text, text, integer, integer)
  to anon, authenticated, service_role;
