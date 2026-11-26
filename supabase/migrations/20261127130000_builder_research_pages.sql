-- Builder research saved copies (AI search plan Phase 4, owner decision 27 Nov 2026, option A): the text of a builder's
-- website page is saved for 7 days after it is read, so the next buyer's question about the same builder does not
-- open the same pages again. A copy older than 7 days is never used and is removed every night. "Read again" on the
-- builder's profile (or the admin's builder page) deletes all of that builder's copies; the next question reads the
-- pages fresh.
--
-- One row is one page (or the site's robots.txt or sitemap.xml), found by its page key: the site without `www.`, the
-- path without a closing `/`, and the query (`pageKey` in src/features/builder-research/site.ts).
--
-- Rules:
-- - Only the server writes copies (service role). A builder reads and deletes its own copies, the super admin all;
--   nobody else reads or writes them.
--
-- Rollback note: additive. Unschedule the job (`select cron.unschedule('builder-research-pages')`) and drop the table.

create table public.builder_research_pages (
  builder_id uuid not null references public.builders (id) on delete cascade,
  page_key text not null check (char_length(page_key) between 1 and 2100),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 2000),
  title text not null default '' check (char_length(title) <= 300),
  -- The page's readable text, or a site file's text (robots.txt). The reader keeps at most 40,000 characters.
  body text not null default '' check (char_length(body) <= 50000),
  -- The page's links as [{ "href": text, "text": text }], in page order (a sitemap's pages, with empty text).
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 200),
  read_at timestamptz not null default now(),
  primary key (builder_id, page_key)
);

create index builder_research_pages_read_at on public.builder_research_pages (read_at);

alter table public.builder_research_pages enable row level security;

revoke all on table public.builder_research_pages from anon, authenticated;
grant select, delete on table public.builder_research_pages to authenticated;

create policy builder_research_pages_select on public.builder_research_pages
  for select to authenticated
  using (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()));

create policy builder_research_pages_delete on public.builder_research_pages
  for delete to authenticated
  using (builder_id = (select public.current_builder_id()) or (select public.is_super_admin()));

-- Every night, copies older than 7 days go.
select cron.schedule(
  'builder-research-pages',
  '40 2 * * *',
  $$delete from public.builder_research_pages where read_at < now() - interval '7 days'$$
);
