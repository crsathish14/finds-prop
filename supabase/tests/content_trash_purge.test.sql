-- ADR-146 (ADR-143 D3, ADR-124): the nightly retention job purges FAQ questions, blog articles and job postings that have been in
-- Trash for more than 30 days, writes a `content.purged` audit entry for each table that purged something, and leaves
-- the picture files of purged articles to be listed by orphan_blog_files(). Tests: DB-FN-run_retention-content,
-- DB-AUDIT-content-purged, DB-FN-orphan_blog_files, DB-PRIV-retention.
-- Fictional content only. Faqs: f1 trashed 31 days ago, f2 trashed 45 days ago (both go), f3 trashed 29 days ago, f4
-- published, f5 a draft that is not in Trash (all stay). Blog: b1 trashed 31 days ago (goes), b2 trashed 29 days ago, b3
-- published and old, b4 a draft, b5 archived (all stay). Jobs: j1 trashed 31 days ago (closed, goes), j2 trashed 29 days
-- ago, j3 open and old, j4 a draft, j5 closed (none of the last four goes; j3, j4 and j5 are not in Trash).
begin;
select plan(29);

insert into public.content_categories (id, module, slug, name) values
  ('00000000-0000-4000-c600-000000000001', 'faq', 'buyers', 'Buyers'),
  ('00000000-0000-4000-c600-000000000002', 'blog', 'buying', 'Buying'),
  ('00000000-0000-4000-c600-000000000003', 'department', 'engineering', 'Engineering');

insert into public.faqs (id, category_id, question, answer, status, deleted_at, created_at) values
  ('00000000-0000-4000-fb00-000000000001', '00000000-0000-4000-c600-000000000001', 'Trashed 31 days ago?', 'It goes tonight.', 'draft', now() - interval '31 days', now() - interval '90 days'),
  ('00000000-0000-4000-fb00-000000000002', '00000000-0000-4000-c600-000000000001', 'Trashed 45 days ago?', 'It goes too.', 'draft', now() - interval '45 days', now() - interval '90 days'),
  ('00000000-0000-4000-fb00-000000000003', '00000000-0000-4000-c600-000000000001', 'Trashed 29 days ago?', 'It stays for now.', 'draft', now() - interval '29 days', now() - interval '90 days'),
  ('00000000-0000-4000-fb00-000000000004', '00000000-0000-4000-c600-000000000001', 'A published question?', 'It stays, however old.', 'published', null, now() - interval '900 days'),
  ('00000000-0000-4000-fb00-000000000005', '00000000-0000-4000-c600-000000000001', 'A draft question?', 'It stays, however old.', 'draft', null, now() - interval '900 days');

insert into public.blog_posts (id, slug, title, excerpt, body, author_name, status, published_at, deleted_at, created_at) values
  ('00000000-0000-4000-b600-000000000001', 'purge-me', 'Purge me please', '', '[{"type": "paragraph", "text": "Gone tonight."}]', 'Asha Rao', 'draft', null, now() - interval '31 days', now() - interval '90 days'),
  ('00000000-0000-4000-b600-000000000002', 'recent-trash', 'Recent trash', '', '[{"type": "paragraph", "text": "Still restorable."}]', 'Asha Rao', 'draft', null, now() - interval '29 days', now() - interval '90 days'),
  ('00000000-0000-4000-b600-000000000003', 'old-published', 'Old published', 'Still live.', '[{"type": "paragraph", "text": "Live."}]', 'Asha Rao', 'published', now() - interval '800 days', null, now() - interval '900 days'),
  ('00000000-0000-4000-b600-000000000004', 'old-draft', 'Old draft', '', '[]', 'Asha Rao', 'draft', null, null, now() - interval '900 days'),
  ('00000000-0000-4000-b600-000000000005', 'old-archived', 'Old archived', 'Archived.', '[]', 'Asha Rao', 'archived', now() - interval '800 days', null, now() - interval '900 days');

insert into public.job_postings (
  id, slug, title, department_id, location, work_mode, employment_type, summary, description, requirements,
  apply_url, status, posted_at, deleted_at, created_at
) values
  ('00000000-0000-4000-aa00-000000000001', 'job-trashed-31', 'Job trashed long ago', '00000000-0000-4000-c600-000000000003', 'Chennai', 'onsite', 'full_time', '', '', '', 'https://example.test/apply', 'closed', now() - interval '200 days', now() - interval '31 days', now() - interval '300 days'),
  ('00000000-0000-4000-aa00-000000000002', 'job-trashed-29', 'Job trashed lately', '00000000-0000-4000-c600-000000000003', 'Chennai', 'hybrid', 'contract', '', '', '', 'https://example.test/apply', 'draft', null, now() - interval '29 days', now() - interval '300 days'),
  ('00000000-0000-4000-aa00-000000000003', 'job-old-open', 'Old open job', '00000000-0000-4000-c600-000000000003', 'Chennai', 'remote', 'full_time', 'Still open.', 'Open for years.', 'Some skills.', 'https://example.test/apply', 'open', now() - interval '800 days', null, now() - interval '900 days'),
  ('00000000-0000-4000-aa00-000000000004', 'job-old-draft', 'Old draft job', '00000000-0000-4000-c600-000000000003', 'Chennai', 'onsite', 'part_time', '', '', '', 'https://example.test/apply', 'draft', null, null, now() - interval '900 days'),
  ('00000000-0000-4000-aa00-000000000005', 'job-old-closed', 'Old closed job', '00000000-0000-4000-c600-000000000003', 'Chennai', 'onsite', 'internship', '', '', '', 'https://example.test/apply', 'closed', now() - interval '800 days', null, now() - interval '900 days');

-- The article pictures, as the storage service would have left them (all files are two days old unless said).
create function pg_temp.put(object_name text, age interval default interval '2 days', bucket text default 'site-assets')
returns void
language sql
as $$
  insert into storage.objects (bucket_id, name, created_at)
  values (bucket, object_name, now() - age)
$$;
select pg_temp.put('blog/00000000-0000-4000-b600-000000000001/cover.png');
select pg_temp.put('blog/00000000-0000-4000-b600-000000000001/a1.webp');
select pg_temp.put('blog/00000000-0000-4000-b600-000000000002/cover.png');
select pg_temp.put('blog/00000000-0000-4000-b600-000000000003/cover.jpg');
-- An upload of an article that was never saved (no row), a new one of the same kind, and files that are not article files.
select pg_temp.put('blog/00000000-0000-4000-b600-0000000000ee/cover.png');
select pg_temp.put('blog/00000000-0000-4000-b600-0000000000ef/cover.png', interval '2 hours');
select pg_temp.put('blog/stray.png');
select pg_temp.put('blog/not-a-uuid/cover.png');
select pg_temp.put('sponsors/banner.png');
select pg_temp.put('blog/00000000-0000-4000-b600-0000000000ee/.emptyFolderPlaceholder');
select pg_temp.put('blog/00000000-0000-4000-b600-0000000000ed/cover.png', interval '2 days', 'listing-photos');

create temp table mark (purged bigint not null, ran bigint not null);
insert into mark
select (select count(*) from public.audit_log where action = 'content.purged'),
       (select count(*) from public.audit_log where action = 'retention.ran');

-- Before the purge: a file of an article that is still in Trash is not an orphan, and no file is wrongly listed.
select is(
  (select array_agg(name order by name) from public.orphan_blog_files()),
  array['blog/00000000-0000-4000-b600-0000000000ee/cover.png'],
  'only the old file of an article that has no row is listed: not an article in Trash, not a live one, not a new file, not another bucket or shape'
);

-- A limited run: one batch of one row for each table.
create temp table first_run as select public.run_retention(1, 1) as answer;
select is(
  (select answer -> 'job_postings' from first_run),
  '1'::jsonb,
  'the limited run also purges the job that was in Trash for 31 days'
);
select is(
  (select count(*) from public.job_postings where id = '00000000-0000-4000-aa00-000000000001')::int,
  0,
  'and it is gone'
);
select is(
  (select answer -> 'faqs' from first_run),
  '1'::jsonb,
  'a limited run purges at most one batch of old questions'
);
select is(
  (select count(*) from public.faqs where id in ('00000000-0000-4000-fb00-000000000001', '00000000-0000-4000-fb00-000000000002'))::int,
  1,
  'one of the two old questions is left for the next run'
);
select is(
  (select count(*) from public.blog_posts where id = '00000000-0000-4000-b600-000000000001')::int,
  0,
  'the article that was in Trash for 31 days is purged'
);
select is(
  public.run_retention() -> 'faqs',
  '1'::jsonb,
  'the next run takes the other old question'
);
select is(
  public.run_retention() - 'skipped',
  (select jsonb_build_object(
    'form_submissions', 0, 'crm_api_logs', 0, 'project_events', 0, 'enquiries', 0, 'project_leads', 0,
    'public_rate_limits', 0, 'idempotency_keys', 0, 'ai_usage_events', 0, 'places_usage_daily', 0,
    'faqs', 0, 'blog_posts', 0, 'job_postings', 0)),
  'a run with nothing left in Trash past 30 days purges nothing'
);

-- What is left
select is(
  (select array_agg(id::text order by id) from public.job_postings),
  array['00000000-0000-4000-aa00-000000000002', '00000000-0000-4000-aa00-000000000003',
        '00000000-0000-4000-aa00-000000000004', '00000000-0000-4000-aa00-000000000005'],
  'a job trashed 29 days ago stays, and so do an open job, a draft and a closed one that are not in Trash, however old'
);
select is(
  (select array_agg(id::text order by id) from public.faqs),
  array['00000000-0000-4000-fb00-000000000003', '00000000-0000-4000-fb00-000000000004', '00000000-0000-4000-fb00-000000000005'],
  'a question trashed 29 days ago stays, and so do a published one and a draft that is not in Trash, however old'
);
select is(
  (select array_agg(id::text order by id) from public.blog_posts),
  array['00000000-0000-4000-b600-000000000002', '00000000-0000-4000-b600-000000000003',
        '00000000-0000-4000-b600-000000000004', '00000000-0000-4000-b600-000000000005'],
  'an article trashed 29 days ago stays, and so do a published one, a draft and an archived one that are not in Trash'
);
select is(
  (select count(*) from public.content_categories where id in
    ('00000000-0000-4000-c600-000000000001', '00000000-0000-4000-c600-000000000002'))::int,
  2,
  'the categories are not touched'
);

-- The audit entries: one for each table that purged something in a run, with names, counts and ids only.
select is(
  (select count(*) from public.audit_log where action = 'content.purged')::int - (select purged from mark)::int,
  4,
  'a content.purged entry is written for each table that purged something in a run, and none for a run that purged nothing'
);
select results_eq(
  $$select actor_role, entity_type, entity_id from public.audit_log
    where action = 'content.purged' and diff ->> 'table' = 'blog_posts'$$,
  $$values ('system'::text, 'content'::text, null::text)$$,
  'it is recorded as the system, about the content'
);
select is(
  (select diff -> 'ids' from public.audit_log where action = 'content.purged' and diff ->> 'table' = 'job_postings'),
  '["00000000-0000-4000-aa00-000000000001"]'::jsonb,
  'the entry for jobs names the purged job by its id'
);
select is(
  (select diff -> 'ids' from public.audit_log where action = 'content.purged' and diff ->> 'table' = 'blog_posts'),
  '["00000000-0000-4000-b600-000000000001"]'::jsonb,
  'the entry names the purged article by its id'
);
select is(
  (select (diff ->> 'count')::int from public.audit_log where action = 'content.purged' and diff ->> 'table' = 'blog_posts'),
  1,
  'and says how many'
);
select is(
  (select diff ->> 'older_than_days' from public.audit_log where action = 'content.purged' and diff ->> 'table' = 'blog_posts'),
  '30',
  'and the window that was applied'
);
select is(
  (select array_agg(key order by key) from jsonb_object_keys(
    (select diff from public.audit_log where action = 'content.purged' and diff ->> 'table' = 'blog_posts')) as key),
  array['count', 'ids', 'older_than_days', 'table'],
  'an entry holds the table, the count, the window and the ids, and nothing else'
);
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'content.purged'
      and (diff::text ~* '(purge me|trashed 31|trashed 45|gone tonight|goes tonight|asha|job trashed|chennai|example\.test)')
  ),
  'no title, question, answer or author name is ever in a purge entry'
);
select is(
  (select count(*) from public.audit_log where action = 'content.purged' and diff ->> 'table' = 'faqs')::int,
  2,
  'the two runs that purged questions wrote one entry each'
);
select is(
  (select count(*) from public.audit_log where action = 'retention.ran')::int - (select ran from mark)::int,
  3,
  'every run still writes its one retention.ran entry'
);
select ok(
  (select diff -> 'faqs' is not null and diff -> 'blog_posts' is not null and diff -> 'job_postings' is not null
   from public.audit_log where action = 'retention.ran' order by id desc limit 1),
  'and that entry holds the count for each content table'
);

-- The pictures: after the purge the files of the purged article are listed, and no others.
select is(
  (select array_agg(name order by name) from public.orphan_blog_files()),
  array['blog/00000000-0000-4000-b600-000000000001/a1.webp', 'blog/00000000-0000-4000-b600-000000000001/cover.png',
        'blog/00000000-0000-4000-b600-0000000000ee/cover.png'],
  'the files of the purged article are listed, and still not those of an article in Trash or a live one'
);
select is(
  (select count(*) from public.orphan_blog_files(1))::int,
  4,
  'a shorter age lists the new unsaved upload too'
);
select is(
  (select count(*) from public.orphan_blog_files(24, 1))::int,
  1,
  'the batch size caps the list'
);

-- Who may run it, and who may list the files
set local role authenticated;
select throws_ok($$select public.run_retention()$$, '42501', null, 'a signed-in user cannot run it');
reset role;
set local role anon;
select throws_ok($$select public.run_retention()$$, '42501', null, 'a visitor cannot run it');
reset role;
select ok(
  not has_function_privilege('anon', 'public.orphan_blog_files(integer,integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.orphan_blog_files(integer,integer)', 'execute')
    and has_function_privilege('service_role', 'public.orphan_blog_files(integer,integer)', 'execute'),
  'only the service role can list orphan blog files'
);

select * from finish();
rollback;
