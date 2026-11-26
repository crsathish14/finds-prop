-- Builder research (AI search plan Phase 4, owner decisions 27 Nov 2026; ADR-211 follows with the assistant's tool):
-- the assistant may read a builder's own website to answer buyers' questions about them. It reads only the website on
-- the builder's profile and up to three more pages the builder (or the super admin) adds here, each with what the
-- page is about. Every page check and every read is logged, so the admin and the builder can see what was read, when,
-- and why a page could not be read.
--
-- Rules:
-- - At most three links per builder, each https, on the builder's own website (the same host as `builders.website`,
--   a leading `www.` ignored), each with one of the fixed topics. Saved only through `save_builder_research_links`,
--   which replaces the whole list at once and checks the caller is that builder or the super admin. Whether a page can
--   be read is checked by the server before it calls this (the database cannot open web pages).
-- - The log is written only by the server (service role, `record_builder_research_read`). A builder reads its own
--   rows, the super admin reads all; nobody else reads or writes it.
--
-- Rollback note: additive. Drop the two functions and the two tables. Fix forward by preference.

-- 1. The extra pages.
create table public.builder_research_links (
  builder_id uuid not null references public.builders (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 2000),
  topic text not null
    check (topic in ('about_company', 'projects', 'delivery_record', 'awards_approvals', 'contact', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (builder_id, position)
);

alter table public.builder_research_links enable row level security;

revoke all on table public.builder_research_links from anon, authenticated;
grant select on table public.builder_research_links to authenticated;

create trigger builder_research_links_updated_at
  before update on public.builder_research_links
  for each row execute function public.touch_updated_at();

create policy builder_research_links_select on public.builder_research_links
  for select to authenticated
  using (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()));

-- 2. The log of page checks and reads.
create table public.builder_research_reads (
  id bigint generated always as identity primary key,
  builder_id uuid not null references public.builders (id) on delete cascade,
  url text not null check (char_length(url) <= 2000),
  -- check: the page was checked when the builder saved it; read: the assistant read it for a buyer's question.
  kind text not null check (kind in ('check', 'read')),
  ok boolean not null,
  problem text
    check (problem in ('not_on_site', 'could_not_open', 'blocked', 'not_a_page', 'too_little_text')),
  created_at timestamptz not null default now(),
  constraint builder_research_reads_problem check ((ok and problem is null) or (not ok and problem is not null))
);

create index builder_research_reads_builder on public.builder_research_reads (builder_id, created_at desc);

alter table public.builder_research_reads enable row level security;

revoke all on table public.builder_research_reads from anon, authenticated;
grant select on table public.builder_research_reads to authenticated;

create policy builder_research_reads_select on public.builder_research_reads
  for select to authenticated
  using (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()));

-- 3. Saving the extra pages: the whole list at once.
-- p_links is a JSON array of up to three { "url": text, "topic": text }, in order.
-- Errors (message, code): research.not_allowed 42501, research.not_found P0002, research.bad_links 22023,
-- research.no_website 55000 (the builder has no website, so no page can be on it), research.not_on_site 22023.
create function public.save_builder_research_links(p_builder uuid, p_links jsonb)
returns setof public.builder_research_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  site text;
  link jsonb;
  link_url text;
  link_topic text;
  link_host text;
  place smallint := 0;
begin
  -- coalesce: for someone who is not a builder `current_builder_id()` is null, and a null comparison must refuse.
  if (select auth.uid()) is null
    or not (
      coalesce(p_builder = (select public.current_builder_id()), false)
      or coalesce((select public.is_super_admin()), false)
    )
  then
    raise exception 'research.not_allowed' using errcode = '42501';
  end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 3 then
    raise exception 'research.bad_links' using errcode = '22023';
  end if;

  select lower(regexp_replace(substring(b.website from '^https://([^/:?#]+)'), '^www\.', ''))
  into site
  from public.builders as b where b.id = p_builder;
  if not found then
    raise exception 'research.not_found' using errcode = 'P0002';
  end if;
  if jsonb_array_length(p_links) > 0 and site is null then
    raise exception 'research.no_website' using errcode = '55000';
  end if;

  delete from public.builder_research_links as l where l.builder_id = p_builder;

  for link in select value from jsonb_array_elements(p_links) loop
    place := place + 1;
    link_url := link ->> 'url';
    link_topic := link ->> 'topic';
    if link_url is null or link_topic is null then
      raise exception 'research.bad_links' using errcode = '22023';
    end if;
    link_host := lower(regexp_replace(substring(link_url from '^https://([^/:?#]+)'), '^www\.', ''));
    if link_host is null or link_host <> site then
      raise exception 'research.not_on_site' using errcode = '22023';
    end if;
    -- The table's own checks refuse a bad address or topic.
    insert into public.builder_research_links (builder_id, position, url, topic)
    values (p_builder, place, link_url, link_topic);
  end loop;

  return query
    select * from public.builder_research_links as l where l.builder_id = p_builder order by l.position;
end;
$$;

revoke execute on function public.save_builder_research_links(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_builder_research_links(uuid, jsonb) to authenticated, service_role;

-- 4. Recording a check or a read. Server only.
create function public.record_builder_research_read(
  p_builder uuid,
  p_url text,
  p_kind text,
  p_ok boolean,
  p_problem text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.builder_research_reads (builder_id, url, kind, ok, problem)
  values (p_builder, left(p_url, 2000), p_kind, p_ok, case when p_ok then null else p_problem end);
end;
$$;

revoke execute on function public.record_builder_research_read(uuid, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_builder_research_read(uuid, text, text, boolean, text) to service_role;
