-- ADR-143 phase 2: the FAQ module's table, its search, and the audit entry for every change.
-- Rules: ADR-143 (FAQ managed from the admin dashboard; the website and the AI assistant read the same function),
-- ADR-017 (the public columns are named), plan 07 section 5 (anyone reads what is visible; only the super admin writes).
-- A question belongs to one category of the `faq` list (`content_categories`). A visitor reads a question only when it
-- is published, not in the trash and its category is active, so a hidden category takes its questions off the page, the
-- search and the AI tools at the same time. The super admin reads and writes everything.
-- Trash is a soft delete: `deleted_at` is set and the question goes back to a draft (a check makes "published and in the
-- trash" impossible, so restoring never republishes by itself). A later, shared change purges old trash; nothing here
-- deletes a row and no role holds the delete privilege.
-- Every change is recorded as `content.changed` (the id, the module and the names of the changed columns, never the
-- text), written by a trigger like the categories' one.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  -- A category cannot be deleted while a question (even a trashed one) still belongs to it.
  category_id uuid not null references public.content_categories (id) on delete restrict,
  question text not null check (char_length(btrim(question)) between 5 and 300),
  -- Plain text; a blank line starts a new paragraph. The page draws it, it is never HTML.
  answer text not null check (char_length(btrim(answer)) between 5 and 5000),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faqs_trashed_is_draft check (deleted_at is null or status = 'draft'),
  -- The question weighs more than the answer (A and B). The 'english' configuration: the answers are English prose, so
  -- "buying", "buyer" and "buy" find each other and filler words ("how do I") are ignored. The listing search uses
  -- 'simple' because it matches names of places, which stemming would damage. Text in another script is kept as it is,
  -- as 'simple' would keep it. The configuration is named in full so the generated column is immutable.
  search_vector tsvector generated always as (
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, question), 'A')
    || pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, answer), 'B')
  ) stored
);

alter table public.faqs enable row level security;

-- The admin's list: one category in the admin's order, and the trash apart.
create index faqs_by_category on public.faqs (category_id, sort_order, created_at)
  where deleted_at is null;
create index faqs_in_trash on public.faqs (deleted_at desc)
  where deleted_at is not null;
-- The visitors' search reads published questions only, so the index is as small as that part of the table.
create index faqs_search_keyword on public.faqs
  using gin (search_vector) where status = 'published' and deleted_at is null;

-- Every column can be read: the rows a visitor may read are published ones, so `status` and `deleted_at` tell them
-- nothing, and the search runs as the caller and needs `search_vector`.
revoke all on table public.faqs from anon, authenticated;
grant select on table public.faqs to anon, authenticated;
grant insert (category_id, question, answer, sort_order, status)
  on table public.faqs to authenticated;
grant update (category_id, question, answer, sort_order, status, deleted_at)
  on table public.faqs to authenticated;

create trigger faqs_updated_at
  before update on public.faqs
  for each row execute function public.touch_updated_at();

-- A question belongs to a category of the FAQ list only: a blog category or a job department is refused. It runs
-- with its own rights so a refusal is the same whatever the caller can see; a category that does not exist is left to
-- the foreign key.
create function public.faqs_category_is_faq()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_module text;
begin
  select category.module into category_module
  from public.content_categories as category
  where category.id = new.category_id;
  if category_module is not null and category_module <> 'faq' then
    raise exception 'a question belongs to a category of the FAQ list' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.faqs_category_is_faq() from public, anon, authenticated;

create trigger faqs_category_is_faq
  before insert or update of category_id on public.faqs
  for each row execute function public.faqs_category_is_faq();

-- Two policies for reading, because a visitor (anon) may not call is_super_admin(). The category lookup runs with the
-- caller's rights, so a visitor finds only an active category and a hidden one hides its questions.
create policy faqs_select_public on public.faqs
  for select to anon
  using (
    status = 'published'
    and deleted_at is null
    and exists (
      select 1 from public.content_categories as category
      where category.id = faqs.category_id and category.module = 'faq' and category.active
    )
  );

create policy faqs_select_signed_in on public.faqs
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      status = 'published'
      and deleted_at is null
      and exists (
        select 1 from public.content_categories as category
        where category.id = faqs.category_id and category.module = 'faq' and category.active
      )
    )
  );

create policy faqs_insert_admin on public.faqs
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy faqs_update_admin on public.faqs
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- The audit entry: which question and what kind of change, never its text.
create function public.audit_faqs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(
      'content.changed', 'faq', new.id::text,
      jsonb_build_object('change', 'created', 'module', 'faq')
    );
  else
    perform public.audit_write(
      'content.changed', 'faq', new.id::text,
      jsonb_build_object(
        'change', 'updated', 'module', 'faq',
        -- The search vector follows the text, so it is not named as a change of its own.
        'columns', public.changed_columns(to_jsonb(old) - 'search_vector', to_jsonb(new) - 'search_vector')
      )
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_faqs() from public, anon, authenticated;

create trigger faqs_audit_insert
  after insert on public.faqs
  for each row execute function public.audit_faqs();

-- A save that changes nothing is not recorded (updated_at alone does not count; the search vector follows the text).
create trigger faqs_audit_update
  after update on public.faqs
  for each row
  when ((old.category_id, old.question, old.answer, old.sort_order, old.status, old.deleted_at)
    is distinct from (new.category_id, new.question, new.answer, new.sort_order, new.status, new.deleted_at))
  execute function public.audit_faqs();

-- The one read the website's FAQ page and the AI assistant's tool share (ADR-143). It runs as the caller
-- (SECURITY INVOKER), so it can only return what the row policies already allow: published, not in the trash, in an
-- active category. Every argument is optional and checked again here:
--   p_query    words to look for (web-search syntax: quotes, "or", a leading minus), at most 200 characters; without
--              it the questions come in the admin's order (category, then question order);
--   p_category the slug of a FAQ category;
--   p_limit    1 to 200.
-- With words the best match comes first (the question counts more than the answer); a query made only of filler words
-- finds nothing. Returns explicit columns, and `rank` is null when there was no query.
create function public.search_faqs(
  p_query text default null,
  p_category text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  category_id uuid,
  category_slug text,
  category_name text,
  question text,
  answer text,
  sort_order integer,
  updated_at timestamptz,
  rank real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  search_words text := nullif(btrim(p_query), '');
  search_query pg_catalog.tsquery;
begin
  if p_limit is null or p_limit not between 1 and 200 then
    raise exception 'p_limit must be between 1 and 200' using errcode = '22023';
  end if;
  if char_length(search_words) > 200 then
    raise exception 'p_query must be at most 200 characters' using errcode = '22023';
  end if;
  if p_category is not null and p_category !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'p_category must be a slug' using errcode = '22023';
  end if;
  if search_words is not null then
    search_query := pg_catalog.websearch_to_tsquery('english'::regconfig, search_words);
  end if;

  return query
  select
    found.id,
    found.category_id,
    category.slug,
    category.name,
    found.question,
    found.answer,
    found.sort_order,
    found.updated_at,
    case when search_query is null then null
      else pg_catalog.ts_rank(found.search_vector, search_query) end
  from public.faqs as found
  join public.content_categories as category on category.id = found.category_id
  where found.status = 'published'
    and found.deleted_at is null
    and category.module = 'faq'
    and (p_category is null or category.slug = p_category)
    and (search_query is null or found.search_vector @@ search_query)
  order by
    case when search_query is null then 0::real
      else - pg_catalog.ts_rank(found.search_vector, search_query) end,
    category.sort_order, category.name, found.sort_order, found.created_at, found.id
  limit p_limit;
end;
$$;

revoke execute on function public.search_faqs(text, text, integer) from public;
grant execute on function public.search_faqs(text, text, integer) to anon, authenticated, service_role;

-- Puts the questions of one category in the order the admin gave: the first id gets sort order 1, the next 2, and so
-- on, all in one statement so a failure changes nothing. It runs as the caller (SECURITY INVOKER), so the table's
-- policies and column grants decide: only the super admin changes a row, and anyone else matches no rows and is told
-- so. The ids must be 1 to 200 different questions of this category that are not in the trash; if any is not (a
-- question of another category, one in the trash, one that does not exist), nothing is changed and the call fails with
-- "no data found" (P0002). Returns the number of questions put in order.
create function public.reorder_faqs(p_category uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) not between 1 and 200 then
    raise exception 'p_ids must hold 1 to 200 ids' using errcode = '22023';
  end if;
  if (select count(distinct listed.id) from pg_catalog.unnest(p_ids) as listed (id))
    <> pg_catalog.cardinality(p_ids) then
    raise exception 'p_ids must not repeat an id' using errcode = '22023';
  end if;

  update public.faqs as item
  set sort_order = ordered.place::integer
  from pg_catalog.unnest(p_ids) with ordinality as ordered (item_id, place)
  where item.id = ordered.item_id and item.category_id = p_category and item.deleted_at is null;
  get diagnostics changed = row_count;

  if changed <> pg_catalog.cardinality(p_ids) then
    raise exception 'a question in the list is not in this category' using errcode = 'P0002';
  end if;
  return changed;
end;
$$;

revoke execute on function public.reorder_faqs(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_faqs(uuid, uuid[]) to authenticated, service_role;
