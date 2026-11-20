-- ADR-143 phase 3: the Blog's articles, and the search over them.
-- Rules: ADR-143 sections 3 and 4 (structured blocks, soft delete, who may read and write), ADR-144 (the block format,
-- slugs and image rules), ADR-017 (the public columns are named), plan 07 section 5 (a visitor reads what is visible;
-- only the super admin writes).
-- A visitor (anon or a signed-in customer) reads an article only when it is published and not in Trash; the super admin
-- reads them all. The test is in the row policy, so the pages, the sitemap and the AI tools see the same rows. A draft,
-- an archived article and a trashed one are never visible to anyone else, whatever the application does.
-- Delete is soft: Trash sets `deleted_at` (the nightly retention job removes old ones later, not here). No client holds
-- the DELETE privilege.
-- The body is a jsonb array of blocks (heading, paragraph, list, quote, image). The database checks the shape and the
-- size, so a bad row cannot be stored by any route; the application checks the same rules first (`features/blog`).
-- Every change is recorded as `content.changed` by a trigger (the id and the names of the changed columns, never the
-- text), like the categories.
-- Rollback note: nothing here is destructive (a new table and functions). Fix forward with a new migration.

-- The plain text of a body, in reading order: every block's text, quote credit, image caption and alt text, and each
-- list item. Used by the search vector, the reading time and the search snippet; the AI tool reads the same text.
create function public.blog_body_text(blocks jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(string_agg(part.piece, ' ' order by block.block_number, part.part_number), '')
  from jsonb_array_elements(case when jsonb_typeof(blocks) = 'array' then blocks else '[]'::jsonb end)
    with ordinality as block (block_value, block_number)
  cross join lateral (
    select 0 as part_number, block.block_value ->> 'text' as piece
    union all select 1, block.block_value ->> 'cite'
    union all select 2, block.block_value ->> 'caption'
    union all select 3, block.block_value ->> 'alt'
    union all
    select 4 + item.item_number::integer, item.item_text
    from jsonb_array_elements_text(
      case when jsonb_typeof(block.block_value -> 'items') = 'array'
        then block.block_value -> 'items' else '[]'::jsonb end
    ) with ordinality as item (item_text, item_number)
  ) as part
  where part.piece is not null
$$;

-- The words an article is searched by: title, excerpt, body and tags.
create function public.blog_search_text(post_title text, post_excerpt text, blocks jsonb, post_tags text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(post_title, '') || ' ' || coalesce(post_excerpt, '') || ' ' || public.blog_body_text(blocks)
    || ' ' || coalesce((select string_agg(tag, ' ') from unnest(post_tags) as tag), '')
$$;

-- About 200 words a minute, never less than one minute.
create function public.blog_read_minutes(blocks jsonb)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select greatest(
    1,
    ceil(coalesce(array_length(regexp_split_to_array(btrim(public.blog_body_text(blocks)), '\s+'), 1), 0) / 200.0)::integer
  )
$$;

-- One block is valid when it has exactly the keys of its type and each value is within its limits.
create function public.blog_block_is_valid(block jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    case when jsonb_typeof(block) <> 'object' then false else
      case block ->> 'type'
        when 'heading' then
          (block - array['type', 'level', 'text']) = '{}'::jsonb
          and jsonb_typeof(block -> 'level') = 'number' and (block ->> 'level') in ('2', '3')
          and jsonb_typeof(block -> 'text') = 'string'
          and char_length(btrim(block ->> 'text')) between 1 and 160
        when 'paragraph' then
          (block - array['type', 'text']) = '{}'::jsonb
          and jsonb_typeof(block -> 'text') = 'string'
          and char_length(btrim(block ->> 'text')) between 1 and 5000
        when 'list' then
          (block - array['type', 'ordered', 'items']) = '{}'::jsonb
          and jsonb_typeof(block -> 'ordered') = 'boolean'
          and case when jsonb_typeof(block -> 'items') = 'array' then
            jsonb_array_length(block -> 'items') between 1 and 50
            and not exists (
              select 1 from jsonb_array_elements(block -> 'items') as item (entry)
              where jsonb_typeof(item.entry) <> 'string'
                or char_length(btrim(item.entry #>> '{}')) not between 1 and 500
            )
          else false end
        when 'quote' then
          (block - array['type', 'text', 'cite']) = '{}'::jsonb
          and jsonb_typeof(block -> 'text') = 'string'
          and char_length(btrim(block ->> 'text')) between 1 and 1000
          and (not jsonb_exists(block, 'cite') or (jsonb_typeof(block -> 'cite') = 'string'
            and char_length(btrim(block ->> 'cite')) between 1 and 120))
        when 'image' then
          (block - array['type', 'path', 'alt', 'caption']) = '{}'::jsonb
          and jsonb_typeof(block -> 'path') = 'string'
          and (block ->> 'path') ~ '^blog/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]{1,40}\.(png|jpg|webp)$'
          and jsonb_typeof(block -> 'alt') = 'string'
          and char_length(btrim(block ->> 'alt')) between 1 and 200
          and (not jsonb_exists(block, 'caption') or (jsonb_typeof(block -> 'caption') = 'string'
            and char_length(btrim(block ->> 'caption')) between 1 and 200))
        else false
      end
    end,
    false
  )
$$;

-- A body is an array of at most 100 valid blocks and at most 100,000 bytes.
create function public.blog_body_is_valid(blocks jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    case when jsonb_typeof(blocks) = 'array' then
      jsonb_array_length(blocks) <= 100
      and octet_length(blocks::text) <= 100000
      and not exists (
        select 1 from jsonb_array_elements(blocks) as block (entry)
        where not public.blog_block_is_valid(block.entry)
      )
    else false end,
    false
  )
$$;

-- Up to ten tags, each lowercase words joined by hyphens, two to forty characters.
create function public.blog_tags_are_valid(post_tags text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    cardinality(post_tags) <= 10
    and not exists (
      select 1 from unnest(post_tags) as tag
      where tag is null or tag !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(tag) not between 2 and 40
    ),
    false
  )
$$;

-- The executor checks EXECUTE for the person writing (a CHECK constraint and a generated column call these) and for the
-- visitor reading (the search calls blog_body_text), so these pure helpers are open to the roles that need them. They
-- only compute on the value they are given and read no table.
revoke execute on function public.blog_body_text(jsonb) from public;
revoke execute on function public.blog_search_text(text, text, jsonb, text[]) from public, anon;
revoke execute on function public.blog_read_minutes(jsonb) from public, anon;
revoke execute on function public.blog_block_is_valid(jsonb) from public, anon;
revoke execute on function public.blog_body_is_valid(jsonb) from public, anon;
revoke execute on function public.blog_tags_are_valid(text[]) from public, anon;
grant execute on function public.blog_body_text(jsonb) to anon, authenticated, service_role;
grant execute on function public.blog_search_text(text, text, jsonb, text[]) to authenticated, service_role;
grant execute on function public.blog_read_minutes(jsonb) to authenticated, service_role;
grant execute on function public.blog_block_is_valid(jsonb) to authenticated, service_role;
grant execute on function public.blog_body_is_valid(jsonb) to authenticated, service_role;
grant execute on function public.blog_tags_are_valid(text[]) to authenticated, service_role;

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  -- The address of the article, /blog/<slug>: made from the title, editable, unique.
  slug text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 120),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 320),
  body jsonb not null default '[]'::jsonb check (public.blog_body_is_valid(body)),
  -- A file of the public site-assets bucket under blog/<id>/.
  cover_path text
    check (cover_path ~ '^blog/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]{1,40}\.(png|jpg|webp)$'),
  cover_alt text check (cover_alt is null or char_length(btrim(cover_alt)) between 1 and 200),
  -- The category must be a Blog category (a trigger checks it); a category with articles cannot be deleted.
  category_id uuid references public.content_categories (id) on delete restrict,
  tags text[] not null default '{}' check (public.blog_tags_are_valid(tags)),
  author_name text not null check (char_length(btrim(author_name)) between 2 and 80),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Set by a trigger the first time the article is published, and kept when it is unpublished and published again.
  published_at timestamptz,
  seo_title text check (seo_title is null or char_length(btrim(seo_title)) between 1 and 70),
  seo_description text check (seo_description is null or char_length(btrim(seo_description)) between 1 and 170),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_minutes integer generated always as (public.blog_read_minutes(body)) stored,
  search_vector tsvector generated always as (
    pg_catalog.to_tsvector('simple'::regconfig, public.blog_search_text(title, excerpt, body, tags))
  ) stored,

  constraint blog_posts_slug_key unique (slug),
  -- A cover needs a description for people who cannot see it.
  constraint blog_posts_cover_has_alt check (cover_path is null or cover_alt is not null),
  -- A published article is complete.
  constraint blog_posts_published_is_complete check (
    status <> 'published' or (
      published_at is not null and jsonb_array_length(body) >= 1 and char_length(btrim(excerpt)) >= 1
    )
  ),
  -- A trashed article is not published: restoring it never puts it back on the site by itself.
  constraint blog_posts_trash_is_not_published check (deleted_at is null or status <> 'published')
);

alter table public.blog_posts enable row level security;

-- The public list, newest first, and the keyword search: published articles that are not in Trash.
create index blog_posts_published on public.blog_posts (published_at desc, id)
  where status = 'published' and deleted_at is null;
create index blog_posts_search on public.blog_posts using gin (search_vector)
  where status = 'published' and deleted_at is null;
create index blog_posts_tags on public.blog_posts using gin (tags)
  where status = 'published' and deleted_at is null;
-- The category filter and the foreign key's delete check.
create index blog_posts_by_category on public.blog_posts (category_id);
-- The admin's list: Trash apart, newest edit first.
create index blog_posts_admin_list on public.blog_posts (deleted_at, updated_at desc);

-- The columns are named (ADR-017), the same for a visitor and a signed-in person. The Trash date is among them: the row
-- policy lets a visitor see only articles that have none, so it is always empty for them, and the admin's list needs it.
revoke all on table public.blog_posts from anon, authenticated;
grant select (
  id, slug, title, excerpt, body, cover_path, cover_alt, category_id, tags, author_name, status, published_at,
  seo_title, seo_description, read_minutes, search_vector, deleted_at, created_at, updated_at
) on table public.blog_posts to anon, authenticated;
-- Nobody writes the id, the dates, the reading time or the search vector; the publish date is the trigger's.
grant insert (
  slug, title, excerpt, body, cover_path, cover_alt, category_id, tags, author_name, status, seo_title,
  seo_description
) on table public.blog_posts to authenticated;
grant update (
  slug, title, excerpt, body, cover_path, cover_alt, category_id, tags, author_name, status, seo_title,
  seo_description, deleted_at
) on table public.blog_posts to authenticated;

create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.touch_updated_at();

-- Two policies, because a visitor (anon) may not call is_super_admin().
create policy blog_posts_select_public on public.blog_posts
  for select to anon
  using (status = 'published' and deleted_at is null);

create policy blog_posts_select_signed_in on public.blog_posts
  for select to authenticated
  using ((status = 'published' and deleted_at is null) or (select public.is_super_admin()));

create policy blog_posts_insert_admin on public.blog_posts
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy blog_posts_update_admin on public.blog_posts
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- Before every write: the category must be a Blog category, and the first publish stamps the date.
create function public.blog_posts_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null
    and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
    and not exists (
      select 1 from public.content_categories as category
      where category.id = new.category_id and category.module = 'blog'
    )
  then
    raise exception 'an article belongs to a Blog category' using errcode = '23514';
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.blog_posts_prepare() from public, anon, authenticated;

create trigger blog_posts_prepare
  before insert or update on public.blog_posts
  for each row execute function public.blog_posts_prepare();

-- The audit entry: which article and what kind of change, never its text.
create function public.audit_blog_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived constant text[] := array['read_minutes', 'search_vector'];
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(
      'content.changed', 'blog_post', new.id::text,
      jsonb_build_object('change', 'created', 'module', 'blog')
    );
  else
    perform public.audit_write(
      'content.changed', 'blog_post', new.id::text,
      jsonb_build_object(
        'change', 'updated', 'module', 'blog',
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

revoke execute on function public.audit_blog_posts() from public, anon, authenticated;

create trigger blog_posts_audit_insert
  after insert on public.blog_posts
  for each row execute function public.audit_blog_posts();

-- A save that changes nothing is not recorded (updated_at alone does not count).
create trigger blog_posts_audit_update
  after update on public.blog_posts
  for each row
  when ((
    old.slug, old.title, old.excerpt, old.body, old.cover_path, old.cover_alt, old.category_id, old.tags,
    old.author_name, old.status, old.published_at, old.seo_title, old.seo_description, old.deleted_at
  ) is distinct from (
    new.slug, new.title, new.excerpt, new.body, new.cover_path, new.cover_alt, new.category_id, new.tags,
    new.author_name, new.status, new.published_at, new.seo_title, new.seo_description, new.deleted_at
  ))
  execute function public.audit_blog_posts();

-- The visitor-facing search (ADR-143 section 3). Runs as the caller (SECURITY INVOKER), so it reads only what the row
-- policy and the column grants allow: published articles that are not in Trash, and active categories. Every argument is
-- optional. `p_query` is read as plain words (quotes, "or" and "-" work); `p_category` is a category slug; `p_tag` is one
-- tag. With words, the best match comes first and `snippet` is a short passage around the matches, the matched words
-- between [[ and ]]; without, the newest comes first and the snippet is the excerpt. `total_count` is the number of
-- matches before the page limit, on every row. Explicit columns only; never the body, which the article page reads.
create function public.search_blog_posts(
  p_query text default null,
  p_category text default null,
  p_tag text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  snippet text,
  cover_path text,
  cover_alt text,
  category_id uuid,
  category_slug text,
  category_name text,
  tags text[],
  author_name text,
  published_at timestamptz,
  read_minutes integer,
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
  category_filter text := nullif(btrim(lower(coalesce(p_category, ''))), '');
  tag_filter text := nullif(btrim(lower(coalesce(p_tag, ''))), '');
  page_size integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  page_start integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
begin
  if words is not null then
    search_query := pg_catalog.websearch_to_tsquery('simple'::regconfig, words);
  end if;
  return query
    select
      post.id,
      post.slug,
      post.title,
      post.excerpt,
      case
        when search_query is null or search_query::text = '' then post.excerpt
        else pg_catalog.ts_headline(
          'simple'::regconfig,
          post.excerpt || ' ' || public.blog_body_text(post.body),
          search_query,
          'StartSel="[[", StopSel="]]", MaxWords=40, MinWords=15, ShortWord=2, MaxFragments=1'
        )
      end,
      post.cover_path,
      post.cover_alt,
      post.category_id,
      category.slug,
      category.name,
      post.tags,
      post.author_name,
      post.published_at,
      post.read_minutes,
      count(*) over ()
    from public.blog_posts as post
    left join public.content_categories as category on category.id = post.category_id
    where post.status = 'published'
      and (search_query is null or post.search_vector @@ search_query)
      and (category_filter is null or category.slug = category_filter)
      and (tag_filter is null or post.tags @> array[tag_filter])
    order by
      case when search_query is null then 0
        else pg_catalog.ts_rank(post.search_vector, search_query) end desc,
      post.published_at desc,
      post.id
    limit page_size
    offset page_start;
end;
$$;

revoke execute on function public.search_blog_posts(text, text, text, integer, integer) from public;
grant execute on function public.search_blog_posts(text, text, text, integer, integer)
  to anon, authenticated, service_role;
