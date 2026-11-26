-- Builder research (AI search plan Phase 4). Tests: DB-RLS-builder_research_links, DB-RLS-builder_research_reads,
-- DB-FN-save_builder_research_links, DB-FN-record_builder_research_read, DB-PRIV-builder-research.
begin;
select plan(24);

-- ad is the reserved admin; b1 and b2 are builders with websites; b3 is a builder with none; c1 is a customer.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'sales@velan.example', now()),
  ('00000000-0000-4000-8000-0000000000b3', 'sales@noweb.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder'),
  ('00000000-0000-4000-8000-0000000000b3', 'builder');
insert into public.builders (id, user_id, email, name, website) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes', 'https://www.kadalhomes.example'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'sales@velan.example', 'Velan Builders', 'https://velan.example/home'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-8000-0000000000b3', 'sales@noweb.example', 'No Web Homes', null);

create function pg_temp.act_as(person uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', person, 'role', 'authenticated')::text, true)
$$;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.builder_research_links'::regclass),
  'the links table has row level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.builder_research_reads'::regclass),
  'the log table has row level security'
);

-- DB-FN-save_builder_research_links: a builder saves its own pages
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
select is(
  (select count(*)::int from public.save_builder_research_links(
    '00000000-0000-4000-b000-000000000001',
    '[{"url": "https://kadalhomes.example/completed-projects", "topic": "delivery_record"},
      {"url": "https://www.kadalhomes.example/about", "topic": "about_company"}]'::jsonb)),
  2, 'a builder saves two pages of its own website, with or without www'
);
select is(
  (select array_agg(topic order by position) from public.builder_research_links
   where builder_id = '00000000-0000-4000-b000-000000000001'),
  array['delivery_record', 'about_company'], 'the pages keep their order and topics'
);
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000001',
    '[{"url": "https://portal.example/kadal", "topic": "projects"}]'::jsonb)$$,
  '22023', 'research.not_on_site', 'a page on another website is refused'
);
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000001',
    '[{"url": "http://kadalhomes.example/about", "topic": "about_company"}]'::jsonb)$$,
  '22023', 'research.not_on_site', 'a page that is not https is refused'
);
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000001',
    '[{"url": "https://kadalhomes.example/a", "topic": "other"}, {"url": "https://kadalhomes.example/b", "topic": "other"},
      {"url": "https://kadalhomes.example/c", "topic": "other"}, {"url": "https://kadalhomes.example/d", "topic": "other"}]'::jsonb)$$,
  '22023', 'research.bad_links', 'more than three pages are refused'
);
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000001',
    '[{"url": "https://kadalhomes.example/news", "topic": "news"}]'::jsonb)$$,
  '23514', null, 'a topic outside the fixed list is refused'
);
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000002',
    '[{"url": "https://velan.example/about", "topic": "about_company"}]'::jsonb)$$,
  '42501', 'research.not_allowed', 'a builder cannot save another builder''s pages'
);
select throws_ok(
  $$insert into public.builder_research_links (builder_id, position, url, topic)
    values ('00000000-0000-4000-b000-000000000001', 3, 'https://kadalhomes.example/x', 'other')$$,
  '42501', null, 'nobody writes the links table directly'
);

-- DB-RLS-builder_research_links: who sees the pages
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select is(
  (select count(*)::int from public.builder_research_links), 0, 'another builder sees none of them'
);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000c1');
select is((select count(*)::int from public.builder_research_links), 0, 'a customer sees none');
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000001', '[]'::jsonb)$$,
  '42501', 'research.not_allowed', 'a customer cannot save pages'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b3');
select throws_ok(
  $$select * from public.save_builder_research_links('00000000-0000-4000-b000-000000000003',
    '[{"url": "https://noweb.example/about", "topic": "about_company"}]'::jsonb)$$,
  '55000', 'research.no_website', 'a builder with no website can add no page'
);

-- The admin saves for any builder and sees every page.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000ad');
select is(
  (select count(*)::int from public.save_builder_research_links(
    '00000000-0000-4000-b000-000000000002',
    '[{"url": "https://velan.example/projects", "topic": "projects"}]'::jsonb)),
  1, 'the admin saves a page for a builder'
);
select is((select count(*)::int from public.builder_research_links), 3, 'the admin sees every builder''s pages');

-- An empty list clears a builder's pages.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select is(
  (select count(*)::int from public.save_builder_research_links('00000000-0000-4000-b000-000000000002', '[]'::jsonb)),
  0, 'an empty list removes the builder''s pages'
);

-- DB-FN-record_builder_research_read and DB-PRIV: only the server writes the log
select throws_ok(
  $$select public.record_builder_research_read('00000000-0000-4000-b000-000000000002', 'https://velan.example', 'read', true)$$,
  '42501', null, 'a builder cannot write the log'
);
reset role;
set local role service_role;
select lives_ok(
  $$select public.record_builder_research_read('00000000-0000-4000-b000-000000000001',
    'https://kadalhomes.example/about', 'check', true)$$,
  'the server records a readable page'
);
select lives_ok(
  $$select public.record_builder_research_read('00000000-0000-4000-b000-000000000002',
    'https://velan.example/projects', 'read', false, 'too_little_text')$$,
  'the server records a page it could not read, with the reason'
);
select throws_ok(
  $$select public.record_builder_research_read('00000000-0000-4000-b000-000000000001',
    'https://kadalhomes.example/x', 'read', false)$$,
  '23514', null, 'a failed read must say why'
);

-- DB-RLS-builder_research_reads: who sees the log
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
select is(
  (select array_agg(url) from public.builder_research_reads),
  array['https://kadalhomes.example/about'], 'a builder sees only its own log'
);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000ad');
select is((select count(*)::int from public.builder_research_reads), 2, 'the admin sees the whole log');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000c1');
select is((select count(*)::int from public.builder_research_reads), 0, 'a customer sees none of the log');

select * from finish();
rollback;
