-- ADR-143 phase 1b content_categories. Tests: DB-RLS-content_categories, DB-CON-content_categories, DB-AUDIT-content.
begin;
select plan(19);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', '919000000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.content_categories (id, module, slug, name, sort_order, active) values
  ('00000000-0000-4000-c300-000000000001', 'blog', 'buying-guide', 'Buying guide', 1, true),
  ('00000000-0000-4000-c300-000000000002', 'blog', 'hidden-topic', 'Hidden topic', 2, false);

-- A visitor reads the active categories only, and writes nothing
set local role anon;
select is(
  (select count(*) from public.content_categories)::int,
  1,
  'a visitor sees only the active category'
);
select throws_ok(
  $$insert into public.content_categories (module, slug, name) values ('faq', 'pricing', 'Pricing')$$,
  '42501',
  null,
  'a visitor cannot add a category'
);
reset role;

-- A customer reads but cannot write
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919000000001"}',
  true
);
select is(
  (select count(*) from public.content_categories)::int,
  1,
  'a customer sees only the active category'
);
select lives_ok(
  $$update public.content_categories set name = 'Hacked' where slug = 'buying-guide'$$,
  'a customer update is accepted but matches no rows'
);
select throws_ok(
  $$insert into public.content_categories (module, slug, name) values ('faq', 'pricing', 'Pricing')$$,
  '42501',
  null,
  'a customer cannot add a category'
);
reset role;
select is(
  (select name from public.content_categories where slug = 'buying-guide'),
  'Buying guide',
  'the category is unchanged after the customer update'
);

-- The super admin reads all and writes
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select is(
  (select count(*) from public.content_categories)::int,
  2,
  'the super admin sees the hidden category too'
);
select lives_ok(
  $$insert into public.content_categories (id, module, slug, name)
    values ('00000000-0000-4000-c300-000000000003', 'faq', 'buying-guide', 'Buying')$$,
  'the same slug may be used again in another module'
);
select lives_ok(
  $$update public.content_categories set name = 'Buying a home', sort_order = 5
    where slug = 'buying-guide' and module = 'blog'$$,
  'the super admin can update a category'
);
select lives_ok(
  $$delete from public.content_categories where id = '00000000-0000-4000-c300-000000000002'$$,
  'the super admin can delete a category'
);
reset role;
select is(
  (select name from public.content_categories where slug = 'buying-guide' and module = 'blog'),
  'Buying a home',
  'the update is stored'
);

-- DB-CON-content_categories
select throws_ok(
  $$insert into public.content_categories (module, slug, name) values ('news', 'x-news', 'News')$$,
  '23514',
  null,
  'a category belongs to blog, faq or department'
);
select throws_ok(
  $$insert into public.content_categories (module, slug, name) values ('blog', 'Bad Slug', 'Bad')$$,
  '23514',
  null,
  'a slug is lowercase words joined by hyphens'
);
select throws_ok(
  $$insert into public.content_categories (module, slug, name) values ('blog', 'buying-guide', 'Again')$$,
  '23505',
  null,
  'a slug is used once in a module'
);
select throws_ok(
  $$insert into public.content_categories (module, slug, name) values ('blog', 'tiny-name', ' ')$$,
  '23514',
  null,
  'a name cannot be blank'
);

-- DB-AUDIT-content: the id, the module and the names of changed columns, never the text
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'content_category'
      and entity_id = '00000000-0000-4000-c300-000000000003'
      and diff = '{"change": "created", "module": "faq"}'::jsonb
  ),
  'adding a category is recorded'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_id = '00000000-0000-4000-c300-000000000001'
      and diff = '{"change": "updated", "module": "blog", "columns": ["name", "sort_order"]}'::jsonb
  ),
  'changing a category records the changed column names, not their values'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_id = '00000000-0000-4000-c300-000000000002'
      and diff = '{"change": "deleted", "module": "blog"}'::jsonb
  ),
  'deleting a category is recorded'
);
create temp table audit_mark (total bigint);
insert into audit_mark select count(*) from public.audit_log;
update public.content_categories set name = 'Buying a home', sort_order = 5
  where slug = 'buying-guide' and module = 'blog';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark),
  'saving a category with the same values is not recorded'
);

select * from finish();
rollback;
