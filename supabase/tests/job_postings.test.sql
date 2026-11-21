-- ADR-143 phase 4 job_postings. Tests: DB-RLS-job_postings, DB-CON-job_postings, DB-AUDIT-content, DB-FN-search_job_postings.
-- Fictional jobs only. Jobs 1 and 2 are visible to a visitor: 1 is open with no closing date, 2 is open and closes in
-- thirty days. Job 3 is a draft, 4 is closed, 5 is open but its closing date has passed, 6 is closed and in Trash. The
-- words "secretword", "closedword", "expiredword" and "trashedword" are in the four that no visitor may find.
begin;
select plan(80);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', '919000000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.content_categories (id, module, slug, name, sort_order) values
  ('00000000-0000-4000-c700-000000000001', 'department', 'engineering', 'Engineering', 1),
  ('00000000-0000-4000-c700-000000000002', 'department', 'sales', 'Sales', 2),
  ('00000000-0000-4000-c700-000000000003', 'faq', 'pricing', 'Pricing', 1);
insert into public.job_postings (
  id, slug, title, department_id, location, work_mode, employment_type, experience, summary, description,
  responsibilities, requirements, apply_url, apply_email, status, closes_at, posted_at, deleted_at
) values
  ('00000000-0000-4000-c700-0000000000a1', 'site-engineer', 'Site Engineer',
   '00000000-0000-4000-c700-000000000001', 'Chennai', 'onsite', 'full_time', '2 to 4 years',
   'Supervise our building sites.',
   E'You will supervise surveying and construction.\n\nYou report to the project head.',
   E'Visit sites daily\nWrite progress reports', E'A civil engineering degree\nTwo years on site',
   'https://jobs.example.test/site-engineer', null, 'open', null, '2026-03-01 10:00:00+00', null),
  ('00000000-0000-4000-c700-0000000000a2', 'sales-executive', 'Sales Executive',
   '00000000-0000-4000-c700-000000000002', 'Madurai', 'hybrid', 'contract', '',
   'Sell homes to families.',
   'You will talk to buyers about flats and plots.',
   '', 'Good with people',
   null, 'jobs@example.test', 'open', now() + interval '30 days', '2026-04-01 10:00:00+00', null),
  ('00000000-0000-4000-c700-0000000000a3', 'draft-job', 'A draft job',
   '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'internship', '',
   '', 'secretword is only in the draft.', '', '',
   'https://jobs.example.test/draft', null, 'draft', null, null, null),
  ('00000000-0000-4000-c700-0000000000a4', 'closed-job', 'A closed job',
   '00000000-0000-4000-c700-000000000001', 'Chennai', 'onsite', 'full_time', '',
   'A job that was closed.', 'closedword was a job once.', '', 'Anything',
   'https://jobs.example.test/closed', null, 'closed', null, '2026-01-01 10:00:00+00', null),
  ('00000000-0000-4000-c700-0000000000a5', 'expired-job', 'An expired job',
   '00000000-0000-4000-c700-000000000001', 'Chennai', 'onsite', 'full_time', '',
   'A job whose date passed.', 'expiredword was open until yesterday.', '', 'Anything',
   'https://jobs.example.test/expired', null, 'open', now() - interval '1 day', '2026-02-01 10:00:00+00', null),
  ('00000000-0000-4000-c700-0000000000a6', 'trashed-job', 'A trashed job',
   '00000000-0000-4000-c700-000000000001', 'Chennai', 'onsite', 'full_time', '',
   'A job in the bin.', 'trashedword was thrown away.', '', 'Anything',
   'https://jobs.example.test/trashed', null, 'closed', null, '2026-02-02 10:00:00+00', now());

-- DB-RLS-job_postings: a visitor reads only open jobs that have not closed and are not in Trash, and writes nothing
set local role anon;
select is(
  (select count(*) from public.job_postings)::int,
  2,
  'a visitor sees the two jobs that are open and have not closed'
);
select set_eq(
  $$select slug from public.job_postings$$,
  $$values ('site-engineer'), ('sales-executive')$$,
  'and not the draft, the closed one, the expired one or the one in Trash'
);
select is_empty(
  $$select 1 from public.job_postings
    where slug in ('draft-job', 'closed-job', 'expired-job', 'trashed-job')$$,
  'a visitor cannot ask for them by address either'
);
select is(
  (select count(*) from public.job_postings where deleted_at is not null)::int,
  0,
  'a visitor never sees a job that has a Trash date'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('visitor-job', 'Visitor job', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote',
            'contract', 'a@example.test')$$,
  '42501',
  null,
  'a visitor cannot add a job'
);
select throws_ok(
  $$update public.job_postings set title = 'Hacked'$$,
  '42501',
  null,
  'a visitor cannot change a job'
);
reset role;

-- The same columns for a visitor and a signed-in person, and nobody writes the id, the dates or the search vector.
select is(
  (select string_agg(attribute.attname::text, ',' order by attribute.attname::text)
   from pg_attribute as attribute
   where attribute.attrelid = 'public.job_postings'::regclass and attribute.attnum > 0
     and not attribute.attisdropped and has_column_privilege('anon', attribute.attrelid, attribute.attname, 'select')),
  (select string_agg(attribute.attname::text, ',' order by attribute.attname::text)
   from pg_attribute as attribute
   where attribute.attrelid = 'public.job_postings'::regclass and attribute.attnum > 0
     and not attribute.attisdropped
     and has_column_privilege('authenticated', attribute.attrelid, attribute.attname, 'select')),
  'a visitor and a signed-in person read the same columns'
);
select ok(
  has_column_privilege('anon', 'public.job_postings', 'id', 'select')
  and has_column_privilege('authenticated', 'public.job_postings', 'id', 'select'),
  'and the id is one of them, for both'
);
select ok(
  not has_table_privilege('anon', 'public.job_postings', 'insert')
  and not has_table_privilege('anon', 'public.job_postings', 'update')
  and not has_table_privilege('authenticated', 'public.job_postings', 'delete'),
  'a visitor holds no write privilege and no one holds the delete privilege'
);
select ok(
  not has_column_privilege('authenticated', 'public.job_postings', 'posted_at', 'update')
  and not has_column_privilege('authenticated', 'public.job_postings', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.job_postings', 'search_vector', 'update'),
  'the posted date, the id and the search vector are never written by a client'
);

-- A customer reads the same and cannot write
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919000000001"}',
  true
);
select is(
  (select count(*) from public.job_postings)::int,
  2,
  'a customer sees only the two visible jobs'
);
select lives_ok(
  $$update public.job_postings set title = 'Hacked' where slug = 'site-engineer'$$,
  'a customer update is accepted but matches no rows'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('customer-job', 'Customer job', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote',
            'contract', 'a@example.test')$$,
  '42501',
  null,
  'a customer cannot add a job'
);
select throws_ok(
  $$delete from public.job_postings where slug = 'site-engineer'$$,
  '42501',
  null,
  'a customer cannot delete a job'
);
reset role;
select is(
  (select title from public.job_postings where slug = 'site-engineer'),
  'Site Engineer',
  'the job is unchanged after the customer update'
);

-- The super admin reads all and writes, and still cannot delete
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select is(
  (select count(*) from public.job_postings)::int,
  6,
  'the super admin sees every job: drafts, closed, expired and Trash too'
);
select lives_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_url)
    values ('new-job', 'A new job', '00000000-0000-4000-c700-000000000001', 'Coimbatore', 'hybrid',
            'full_time', 'https://jobs.example.test/new')$$,
  'the super admin can add a job'
);
select lives_ok(
  $$update public.job_postings set title = 'A better job', summary = 'Short.' where slug = 'new-job'$$,
  'the super admin can edit a job'
);
select lives_ok(
  $$update public.job_postings set deleted_at = now() where slug = 'new-job'$$,
  'the super admin can move a job to Trash'
);
select lives_ok(
  $$update public.job_postings set deleted_at = null where slug = 'new-job'$$,
  'and restore it'
);
select throws_ok(
  $$delete from public.job_postings where slug = 'new-job'$$,
  '42501',
  null,
  'nobody holds the delete privilege: Trash is an update'
);
select throws_ok(
  $$update public.job_postings set posted_at = now() where slug = 'new-job'$$,
  '42501',
  null,
  'the posted date is the database''s, not a column the admin writes'
);
reset role;

-- DB-CON-job_postings
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('Bad Slug', 'Bad slug job', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test')$$,
  '23514', null, 'a slug is lowercase words joined by hyphens'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('site-engineer', 'Same slug', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test')$$,
  '23505', null, 'a slug is used once'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('short-title', 'No', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test')$$,
  '23514', null, 'a title has at least three characters'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('no-place', 'Job with no place', '00000000-0000-4000-c700-000000000001', ' ', 'remote', 'contract', 'a@example.test')$$,
  '23514', null, 'a location cannot be blank'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('odd-mode', 'Job with an odd mode', '00000000-0000-4000-c700-000000000001', 'Chennai', 'moon', 'contract', 'a@example.test')$$,
  '23514', null, 'a work mode is onsite, hybrid or remote'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('odd-type', 'Job with an odd type', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'forever', 'a@example.test')$$,
  '23514', null, 'an employment type is full time, part time, contract or internship'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, status)
    values ('odd-status', 'Job with an odd status', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', 'paused')$$,
  '23514', null, 'a status is draft, open or closed'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type)
    values ('no-apply', 'Job with no way to apply', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract')$$,
  '23514', null, 'a job has a way to apply'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_url, apply_email)
    values ('two-apply', 'Job with two ways to apply', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'https://jobs.example.test/x', 'a@example.test')$$,
  '23514', null, 'and exactly one: a link or an email address, not both'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_url)
    values ('http-apply', 'Job with an http link', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'http://jobs.example.test/x')$$,
  '23514', null, 'an apply link must be https'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_url)
    values ('script-apply', 'Job with a script link', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'javascript:alert(1)')$$,
  '23514', null, 'a script address is not an apply link'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_url)
    values ('user-apply', 'Job with a sign-in part', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'https://jobs.example.test@evil.test/x')$$,
  '23514', null, 'an apply link has no sign-in part before the host'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_url)
    values ('space-apply', 'Job with a spaced link', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'https://jobs.example.test/a b')$$,
  '23514', null, 'an apply link has no spaces'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('bad-email', 'Job with a bad email', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'not an email')$$,
  '23514', null, 'an apply email address looks like one'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, salary_note)
    values ('blank-salary', 'Job with a blank salary note', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', ' ')$$,
  '23514', null, 'a salary note is either left out or says something'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, description)
    values ('long-text', 'Job with too much text', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', repeat('x', 8001))$$,
  '23514', null, 'a description has at most 8,000 characters'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, experience)
    values ('long-experience', 'Job with long experience', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', repeat('x', 81))$$,
  '23514', null, 'the experience line has at most 80 characters'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, status, summary, description, requirements)
    values ('empty-open', 'Open and empty', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', 'open', 'A summary.', '', 'Something')$$,
  '23514', null, 'an open job has a description'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, status, summary, description, requirements)
    values ('no-requirements', 'Open without requirements', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', 'open', 'A summary.', 'A description.', ' ')$$,
  '23514', null, 'an open job has requirements'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email, status, summary, description, requirements)
    values ('no-summary', 'Open without a summary', '00000000-0000-4000-c700-000000000001', 'Chennai', 'remote', 'contract', 'a@example.test', 'open', '', 'A description.', 'Something')$$,
  '23514', null, 'an open job has a summary'
);
select throws_ok(
  $$update public.job_postings set deleted_at = now() where slug = 'site-engineer'$$,
  '23514', null, 'an open job is closed before it goes to Trash'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('wrong-department', 'In a question category', '00000000-0000-4000-c700-000000000003', 'Chennai', 'remote', 'contract', 'a@example.test')$$,
  '23514', null, 'the department must be a department category'
);
select throws_ok(
  $$update public.job_postings set department_id = '00000000-0000-4000-c700-000000000003' where slug = 'draft-job'$$,
  '23514', null, 'and a job cannot be moved to a category of another list'
);
select throws_ok(
  $$insert into public.job_postings (slug, title, department_id, location, work_mode, employment_type, apply_email)
    values ('ghost-department', 'In no department at all', '00000000-0000-4000-c700-0000000000ff', 'Chennai', 'remote', 'contract', 'a@example.test')$$,
  '23503', null, 'a department that does not exist is refused'
);
select throws_ok(
  $$delete from public.content_categories where id = '00000000-0000-4000-c700-000000000001'$$,
  '23503', null, 'a department with jobs cannot be deleted, even when they are in Trash'
);
select lives_ok(
  $$update public.job_postings set department_id = '00000000-0000-4000-c700-000000000002' where slug = 'draft-job'$$,
  'a job can move to another department'
);

-- The posted date
select ok(
  (select posted_at is null from public.job_postings where slug = 'draft-job'),
  'a draft has no posted date'
);
update public.job_postings
  set status = 'open', summary = 'Now ready.', description = 'Ready to read.', requirements = 'Ready to work'
  where slug = 'draft-job';
select ok(
  (select posted_at is not null from public.job_postings where slug = 'draft-job'),
  'opening a job stamps the posted date'
);
create temp table first_date as select posted_at from public.job_postings where slug = 'draft-job';
update public.job_postings set status = 'closed' where slug = 'draft-job';
update public.job_postings set status = 'open' where slug = 'draft-job';
select is(
  (select posted_at from public.job_postings where slug = 'draft-job'),
  (select posted_at from first_date),
  'closing and opening again keeps the first posted date'
);
update public.job_postings
  set status = 'draft', description = 'secretword is only in the draft.' where slug = 'draft-job';

-- The search vector: the title weighs more than the long text
select ok(
  (select search_vector @@ pg_catalog.to_tsquery('english', 'engineer & chennai & surveying')
   from public.job_postings where slug = 'site-engineer'),
  'the search vector holds the title, the place and the description'
);
select ok(
  not (select search_vector @@ pg_catalog.to_tsquery('english', 'surveying')
       from public.job_postings where slug = 'sales-executive'),
  'and only the words of its own job'
);

-- DB-AUDIT-content: the id and the names of changed columns, never the text
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'job_posting'
      and entity_id = (select id::text from public.job_postings where slug = 'new-job')
      and diff = '{"change": "created", "module": "careers"}'::jsonb
  ),
  'adding a job is recorded'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_id = (select id::text from public.job_postings where slug = 'new-job')
      and diff = '{"change": "updated", "module": "careers", "columns": ["summary", "title"]}'::jsonb
  ),
  'changing a job records the changed column names, not their values or the search vector'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_id = (select id::text from public.job_postings where slug = 'new-job')
      and diff = '{"change": "updated", "module": "careers", "columns": ["deleted_at"]}'::jsonb
  ),
  'moving a job to Trash and back is recorded'
);
select is(
  (select count(*) from public.audit_log
   where entity_id = (select id::text from public.job_postings where slug = 'new-job') and diff::text like '%A better job%'),
  0::bigint,
  'the title text is never in the audit entry'
);
create temp table audit_mark (total bigint);
insert into audit_mark select count(*) from public.audit_log;
update public.job_postings set title = 'A better job' where slug = 'new-job';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark),
  'saving a job with the same values is not recorded'
);

-- DB-FN-search_job_postings: the visitor's search
set local role anon;
select is(
  (select count(*) from public.search_job_postings('surveying'))::int,
  1,
  'a word in the description finds the job'
);
select is(
  (select slug from public.search_job_postings('surveying')),
  'site-engineer',
  'and it is the right one'
);
select ok(
  (select snippet like '%[[surveying]]%' from public.search_job_postings('surveying')),
  'the snippet marks the matched word'
);
select is(
  (select total_count from public.search_job_postings('surveying')),
  1::bigint,
  'every row carries the total'
);
select is(
  (select slug from public.search_job_postings('engineers')),
  'site-engineer',
  'words are stemmed: "engineers" finds "Site Engineer"'
);
select is(
  (select count(*) from public.search_job_postings('secretword'))::int,
  0,
  'a word only in a draft finds nothing'
);
select is(
  (select count(*) from public.search_job_postings('closedword'))::int,
  0,
  'a word only in a closed job finds nothing'
);
select is(
  (select count(*) from public.search_job_postings('expiredword'))::int,
  0,
  'a word only in a job whose closing date has passed finds nothing'
);
select is(
  (select count(*) from public.search_job_postings('trashedword'))::int,
  0,
  'a word only in a job in Trash finds nothing'
);
select is(
  (select count(*) from public.search_job_postings('the'))::int,
  0,
  'a search of filler words only finds nothing'
);
select is(
  (select array_agg(slug order by posted_at desc) from public.search_job_postings()),
  array['sales-executive', 'site-engineer'],
  'with no words, every visible job, newest first'
);
select is(
  (select slug from public.search_job_postings(p_department => 'engineering')),
  'site-engineer',
  'a department slug narrows the list'
);
select is(
  (select department_name from public.search_job_postings(p_department => 'engineering')),
  'Engineering',
  'and the department name comes with the row'
);
select is(
  (select count(*) from public.search_job_postings(p_department => 'pricing'))::int,
  0,
  'a slug that is not a department finds nothing'
);
select is(
  (select slug from public.search_job_postings(p_location => 'MADURAI')),
  'sales-executive',
  'a place narrows the list, in any case'
);
select is(
  (select slug from public.search_job_postings(p_work_mode => 'hybrid')),
  'sales-executive',
  'a work mode narrows the list'
);
select is(
  (select slug from public.search_job_postings(p_type => 'full_time')),
  'site-engineer',
  'an employment type narrows the list'
);
select is(
  (select slug from public.search_job_postings('homes', p_work_mode => 'hybrid', p_type => 'contract')),
  'sales-executive',
  'words and filters work together'
);
select is(
  (select slug from public.search_job_postings(p_limit => 1, p_offset => 1)),
  'site-engineer',
  'a page is a limit and an offset'
);
select is(
  (select total_count from public.search_job_postings(p_limit => 1, p_offset => 1)),
  2::bigint,
  'and the total is the count before the page'
);
select is(
  (select count(*) from public.search_job_postings(p_limit => 0))::int,
  1,
  'a limit below one is raised to one'
);
reset role;

-- The super admin's call returns what a visitor sees, not their drafts
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select set_eq(
  $$select slug from public.search_job_postings(p_limit => 50)$$,
  $values ('site-engineer'), ('sales-executive')$,
  'the search never lists a draft, a closed, an expired or a trashed job, even for the super admin'
);
reset role;

select * from finish();
rollback;
