-- ADR-143 phase 2 faqs. Tests: DB-RLS-faqs, DB-CON-faqs, DB-SEARCH-faqs, DB-AUDIT-content.
-- Fictional data only. The rows a visitor may read are published, not in the trash and in an active FAQ category.
begin;
select plan(59);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', '919000000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

insert into public.content_categories (id, module, slug, name, sort_order, active) values
  ('00000000-0000-4000-c400-000000000001', 'faq', 'buyers', 'Buyers', 1, true),
  ('00000000-0000-4000-c400-000000000002', 'faq', 'sellers', 'Sellers', 2, true),
  ('00000000-0000-4000-c400-000000000003', 'faq', 'hidden-group', 'Hidden group', 3, false),
  ('00000000-0000-4000-c400-000000000004', 'blog', 'blog-topic', 'Blog topic', 1, true),
  ('00000000-0000-4000-c400-000000000005', 'department', 'sales', 'Sales', 1, true);

-- f1 f5 f7 f8: published in Buyers. f9: published in Sellers. f2: a draft. f3: published, but its category is hidden.
-- f4: in the trash.
insert into public.faqs (id, category_id, question, answer, sort_order, status, deleted_at) values
  ('00000000-0000-4000-fa00-000000000001', '00000000-0000-4000-c400-000000000001',
   'How do I list my property?', 'Sign in, choose Post a property and fill in the steps.', 1, 'published', null),
  ('00000000-0000-4000-fa00-000000000002', '00000000-0000-4000-c400-000000000001',
   'A draft question', 'This answer is not ready for visitors yet.', 2, 'draft', null),
  ('00000000-0000-4000-fa00-000000000003', '00000000-0000-4000-c400-000000000003',
   'A question in a hidden group', 'The group is switched off, so nobody sees this.', 1, 'published', null),
  ('00000000-0000-4000-fa00-000000000004', '00000000-0000-4000-c400-000000000001',
   'A trashed question', 'This one was moved to the trash.', 3, 'draft', now()),
  ('00000000-0000-4000-fa00-000000000005', '00000000-0000-4000-c400-000000000001',
   'Which papers do I need?', 'Keep the sale deed and an identity proof ready.', 2, 'published', null),
  ('00000000-0000-4000-fa00-000000000007', '00000000-0000-4000-c400-000000000001',
   'Verification steps', 'An agent will phone you.', 3, 'published', null),
  ('00000000-0000-4000-fa00-000000000008', '00000000-0000-4000-c400-000000000001',
   'Contacting the team', 'Our verification team is available all week.', 4, 'published', null),
  ('00000000-0000-4000-fa00-000000000009', '00000000-0000-4000-c400-000000000002',
   'How long does a listing stay up?', 'It stays up until you close it.', 1, 'published', null);

-- A visitor reads the visible questions only, and writes nothing
set local role anon;
select is(
  (select count(*) from public.faqs)::int,
  5,
  'a visitor sees only the published questions of active categories, not the draft, the trashed or the hidden one'
);
select is(
  (select count(*) from public.faqs where id in (
    '00000000-0000-4000-fa00-000000000002', '00000000-0000-4000-fa00-000000000003',
    '00000000-0000-4000-fa00-000000000004'))::int,
  0,
  'a visitor cannot find the draft, the hidden-category question or the trashed one by its id'
);
select throws_ok(
  $$insert into public.faqs (category_id, question, answer)
    values ('00000000-0000-4000-c400-000000000001', 'A visitor question', 'A visitor answer')$$,
  '42501',
  null,
  'a visitor cannot add a question'
);
select throws_ok(
  $$update public.faqs set answer = 'Hacked answer' where id = '00000000-0000-4000-fa00-000000000001'$$,
  '42501',
  null,
  'a visitor cannot change a question'
);
select throws_ok(
  $$select public.reorder_faqs('00000000-0000-4000-c400-000000000001',
    array['00000000-0000-4000-fa00-000000000001']::uuid[])$$,
  '42501',
  null,
  'a visitor cannot put questions in order'
);
reset role;

-- A customer reads the same rows but cannot write
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919000000001"}',
  true
);
select is(
  (select count(*) from public.faqs)::int,
  5,
  'a customer sees only the visible questions'
);
select lives_ok(
  $$update public.faqs set answer = 'Hacked answer' where id = '00000000-0000-4000-fa00-000000000001'$$,
  'a customer update is accepted but matches no rows'
);
select throws_ok(
  $$insert into public.faqs (category_id, question, answer)
    values ('00000000-0000-4000-c400-000000000001', 'A customer question', 'A customer answer')$$,
  '42501',
  null,
  'a customer cannot add a question'
);
select throws_ok(
  $$select public.reorder_faqs('00000000-0000-4000-c400-000000000001',
    array['00000000-0000-4000-fa00-000000000001']::uuid[])$$,
  'P0002',
  null,
  'a customer cannot put questions in order: the policies match no row, so the call fails and changes nothing'
);
reset role;
select is(
  (select answer from public.faqs where id = '00000000-0000-4000-fa00-000000000001'),
  'Sign in, choose Post a property and fill in the steps.',
  'the answer is unchanged after the customer update'
);

-- DB-SEARCH-faqs: search_faqs() runs as the caller, so it returns what the policies allow
set local role anon;
select results_eq(
  $$select question from public.search_faqs()$$,
  $$values ('How do I list my property?'), ('Which papers do I need?'), ('Verification steps'),
    ('Contacting the team'), ('How long does a listing stay up?')$$,
  'without words the visible questions come back in the admin''s order: category, then question order'
);
select is(
  (select count(*) from public.search_faqs('property'))::int,
  1,
  'a word finds the question that holds it'
);
select is(
  (select count(*) from public.search_faqs('properties'))::int,
  1,
  'a plural finds the singular (the words are stemmed)'
);
select results_eq(
  $$select question from public.search_faqs('sale deed')$$,
  $$values ('Which papers do I need?')$$,
  'words in the answer are found too'
);
select results_eq(
  $$select question from public.search_faqs('verification')$$,
  $$values ('Verification steps'), ('Contacting the team')$$,
  'a match in the question comes before a match in the answer'
);
select is(
  (select count(*) from public.search_faqs('the and'))::int,
  0,
  'a search made only of filler words finds nothing'
);
select is(
  (select count(*) from public.search_faqs('draft'))::int,
  0,
  'a draft cannot be found'
);
select is(
  (select count(*) from public.search_faqs('trash'))::int,
  0,
  'a trashed question cannot be found'
);
select is(
  (select count(*) from public.search_faqs('hidden'))::int,
  0,
  'a question of a hidden category cannot be found'
);
select is(
  (select count(*) from public.search_faqs(null, 'buyers'))::int,
  4,
  'a category slug limits the search to that category'
);
select is(
  (select count(*) from public.search_faqs(null, 'hidden-group'))::int,
  0,
  'a hidden category answers nothing'
);
select is(
  (select count(*) from public.search_faqs('listing', 'sellers'))::int,
  1,
  'words and a category work together'
);
select is(
  (select count(*) from public.search_faqs(null, null, 2))::int,
  2,
  'the limit cuts the list'
);
select ok(
  (select rank is null from public.search_faqs() limit 1),
  'the rank is empty when there was no search'
);
select ok(
  (select min(rank) from public.search_faqs('verification')) > 0,
  'the rank is filled when there was a search'
);
select throws_ok(
  $$select * from public.search_faqs(null, null, 0)$$,
  '22023',
  null,
  'a limit of nothing is refused'
);
select throws_ok(
  $$select * from public.search_faqs(null, null, 201)$$,
  '22023',
  null,
  'a limit above 200 is refused'
);
select throws_ok(
  $$select * from public.search_faqs(null, 'Not A Slug')$$,
  '22023',
  null,
  'a category that is not a slug is refused'
);
select throws_ok(
  $$select * from public.search_faqs(repeat('a', 201))$$,
  '22023',
  null,
  'a search longer than 200 characters is refused'
);
reset role;
select is(
  (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'search_faqs'),
  false,
  'the search runs as the caller, not as its owner'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'faqs_search_keyword'
      and indexdef like '%USING gin (search_vector)%' and indexdef like '%published%'
  ),
  'the keyword index covers published questions only'
);
select ok(
  (select search_vector from public.faqs where id = '00000000-0000-4000-fa00-000000000007')
    @@ pg_catalog.to_tsquery('english'::regconfig, 'verification:A')
  and not (select search_vector from public.faqs where id = '00000000-0000-4000-fa00-000000000008')
    @@ pg_catalog.to_tsquery('english'::regconfig, 'verification:A'),
  'the question weighs more than the answer'
);

-- The super admin reads all and writes
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select is(
  (select count(*) from public.faqs)::int,
  8,
  'the super admin sees the draft, the trashed and the hidden-category questions too'
);
select lives_ok(
  $$insert into public.faqs (id, category_id, question, answer, sort_order)
    values ('00000000-0000-4000-fa00-000000000006', '00000000-0000-4000-c400-000000000002',
      'Can I change my listing?', 'Yes, edit it from your dashboard.', 2)$$,
  'the super admin can add a question (it starts as a draft)'
);
select lives_ok(
  $$update public.faqs set question = 'Can I edit my listing later?', sort_order = 5
    where id = '00000000-0000-4000-fa00-000000000006'$$,
  'the super admin can update a question'
);
select lives_ok(
  $$update public.faqs set status = 'published' where id = '00000000-0000-4000-fa00-000000000006'$$,
  'the super admin can publish a question'
);
select throws_ok(
  $$update public.faqs set deleted_at = now() where id = '00000000-0000-4000-fa00-000000000005'$$,
  '23514',
  null,
  'a published question cannot be put in the trash: it goes back to a draft in the same save'
);
select lives_ok(
  $$update public.faqs set status = 'draft', deleted_at = now() where id = '00000000-0000-4000-fa00-000000000006'$$,
  'the super admin can put a question in the trash'
);
select lives_ok(
  $$update public.faqs set deleted_at = null where id = '00000000-0000-4000-fa00-000000000006'$$,
  'the super admin can restore a question'
);
select throws_ok(
  $$delete from public.faqs where id = '00000000-0000-4000-fa00-000000000006'$$,
  '42501',
  null,
  'no one can delete a question: the trash is a soft delete'
);
select throws_ok(
  $$update public.faqs set created_at = now() where id = '00000000-0000-4000-fa00-000000000006'$$,
  '42501',
  null,
  'the creation time is not a column anyone can change'
);
select lives_ok(
  $$select public.reorder_faqs('00000000-0000-4000-c400-000000000001', array[
    '00000000-0000-4000-fa00-000000000008', '00000000-0000-4000-fa00-000000000007',
    '00000000-0000-4000-fa00-000000000005', '00000000-0000-4000-fa00-000000000001']::uuid[])$$,
  'the super admin can put the questions of a category in order'
);
select throws_ok(
  $$select public.reorder_faqs('00000000-0000-4000-c400-000000000001', array[
    '00000000-0000-4000-fa00-000000000001', '00000000-0000-4000-fa00-000000000009']::uuid[])$$,
  'P0002',
  null,
  'a question of another category in the list is refused'
);
select throws_ok(
  $$select public.reorder_faqs('00000000-0000-4000-c400-000000000001', array[
    '00000000-0000-4000-fa00-000000000001', '00000000-0000-4000-fa00-000000000001']::uuid[])$$,
  '22023',
  null,
  'the same question twice in the list is refused'
);
select throws_ok(
  $$select public.reorder_faqs('00000000-0000-4000-c400-000000000001', array[]::uuid[])$$,
  '22023',
  null,
  'an empty list is refused'
);
reset role;
select results_eq(
  $$select id, sort_order from public.faqs
    where id in ('00000000-0000-4000-fa00-000000000001', '00000000-0000-4000-fa00-000000000005',
      '00000000-0000-4000-fa00-000000000007', '00000000-0000-4000-fa00-000000000008')
    order by sort_order$$,
  $$values ('00000000-0000-4000-fa00-000000000008'::uuid, 1), ('00000000-0000-4000-fa00-000000000007'::uuid, 2),
    ('00000000-0000-4000-fa00-000000000005'::uuid, 3), ('00000000-0000-4000-fa00-000000000001'::uuid, 4)$$,
  'the questions follow the order given, from 1, and the refused calls changed nothing'
);
select is(
  (select status from public.faqs where id = '00000000-0000-4000-fa00-000000000006'),
  'draft',
  'a restored question comes back as a draft, never published'
);

-- DB-CON-faqs
select throws_ok(
  $$insert into public.faqs (category_id, question, answer)
    values ('00000000-0000-4000-c400-000000000004', 'A blog category question', 'It must be refused.')$$,
  '23514',
  null,
  'a question cannot belong to a blog category'
);
select throws_ok(
  $$update public.faqs set category_id = '00000000-0000-4000-c400-000000000005'
    where id = '00000000-0000-4000-fa00-000000000001'$$,
  '23514',
  null,
  'a question cannot be moved to a job department'
);
select throws_ok(
  $$insert into public.faqs (category_id, question, answer)
    values ('00000000-0000-4000-c400-0000000000ff', 'A question with no category', 'It must be refused.')$$,
  '23503',
  null,
  'a question needs a category that exists'
);
select throws_ok(
  $$insert into public.faqs (category_id, question, answer)
    values ('00000000-0000-4000-c400-000000000001', 'Why', 'It must be refused.')$$,
  '23514',
  null,
  'a question has at least five characters'
);
select throws_ok(
  $$insert into public.faqs (category_id, question, answer)
    values ('00000000-0000-4000-c400-000000000001', 'A question with a blank answer', '    ')$$,
  '23514',
  null,
  'an answer cannot be blank'
);
select throws_ok(
  $$insert into public.faqs (category_id, question, answer, status)
    values ('00000000-0000-4000-c400-000000000001', 'A question with an odd status', 'Not allowed.', 'archived')$$,
  '23514',
  null,
  'a question is a draft or published'
);
select throws_like(
  $$delete from public.content_categories where id = '00000000-0000-4000-c400-000000000001'$$,
  '%violates foreign key constraint%',
  'a category that still holds questions cannot be deleted'
);

-- DB-AUDIT-content: the id, the module and the names of changed columns, never the text
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'faq'
      and entity_id = '00000000-0000-4000-fa00-000000000006'
      and diff = '{"change": "created", "module": "faq"}'::jsonb
  ),
  'adding a question is recorded'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'faq'
      and entity_id = '00000000-0000-4000-fa00-000000000006'
      and diff = '{"change": "updated", "module": "faq", "columns": ["question", "sort_order"]}'::jsonb
  ),
  'changing a question records the changed column names, not their values'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'faq'
      and entity_id = '00000000-0000-4000-fa00-000000000006'
      and diff = '{"change": "updated", "module": "faq", "columns": ["deleted_at", "status"]}'::jsonb
  ),
  'trashing a question is recorded as a change of its status and its trash time'
);
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'faq'
      and (diff::text like '%listing%' or (diff -> 'columns') ? 'search_vector')
  ),
  'the text of a question is never recorded, and the search vector is not named as a change'
);
create temp table audit_mark (total bigint);
insert into audit_mark select count(*) from public.audit_log;
update public.faqs set question = 'Can I edit my listing later?', sort_order = 5
  where id = '00000000-0000-4000-fa00-000000000006';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark),
  'saving a question with the same values is not recorded'
);

select * from finish();
rollback;
