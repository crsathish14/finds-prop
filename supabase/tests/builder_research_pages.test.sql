-- Builder research saved copies (AI search plan Phase 4). Tests: DB-RLS-builder_research_pages,
-- DB-JOB-builder-research-pages. Who reads and deletes which copies is in rls_matrix.test.sql.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now());
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b1', 'builder');
insert into public.builders (id, user_id, email, name, website) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes', 'https://www.kadalhomes.example');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.builder_research_pages'::regclass),
  'the saved copies table has row level security'
);

insert into public.builder_research_pages (builder_id, page_key, url, title, body, links) values
  ('00000000-0000-4000-b000-000000000001', 'kadalhomes.example/about', 'https://www.kadalhomes.example/about',
   'About us', 'We build homes in Chennai.', '[{"href": "https://www.kadalhomes.example/projects", "text": "Projects"}]');

select throws_ok(
  $$insert into public.builder_research_pages (builder_id, page_key, url)
    values ('00000000-0000-4000-b000-000000000001', 'kadalhomes.example/about', 'https://www.kadalhomes.example/about')$$,
  '23505', null, 'one copy per page of a builder'
);
select throws_ok(
  $$insert into public.builder_research_pages (builder_id, page_key, url)
    values ('00000000-0000-4000-b000-000000000001', 'kadalhomes.example/x', 'http://www.kadalhomes.example/x')$$,
  '23514', null, 'only https addresses'
);
select throws_ok(
  $$insert into public.builder_research_pages (builder_id, page_key, url, body)
    values ('00000000-0000-4000-b000-000000000001', 'kadalhomes.example/long', 'https://www.kadalhomes.example/long',
            repeat('a', 50001))$$,
  '23514', null, 'a copy holds at most 50,000 characters'
);
select throws_ok(
  $$insert into public.builder_research_pages (builder_id, page_key, url, links)
    values ('00000000-0000-4000-b000-000000000001', 'kadalhomes.example/obj', 'https://www.kadalhomes.example/obj',
            '{"href": "x"}')$$,
  '23514', null, 'links are a list'
);
select ok(
  not has_table_privilege('anon', 'public.builder_research_pages', 'select'),
  'a visitor cannot read saved copies'
);
select ok(
  not has_table_privilege('authenticated', 'public.builder_research_pages', 'insert')
    and not has_table_privilege('authenticated', 'public.builder_research_pages', 'update'),
  'nobody signed in writes a copy; only the server does'
);
select is(
  (select schedule from cron.job where jobname = 'builder-research-pages'),
  '40 2 * * *', 'old copies are removed every night'
);

delete from public.builders where id = '00000000-0000-4000-b000-000000000001';
select is(
  (select count(*)::int from public.builder_research_pages),
  0, 'a removed builder''s copies go with it'
);

select * from finish();
rollback;
