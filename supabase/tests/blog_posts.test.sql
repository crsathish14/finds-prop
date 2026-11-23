-- ADR-143 phase 3 blog_posts. Tests: DB-RLS-blog_posts, DB-CON-blog_posts, DB-AUDIT-content, DB-FN-search_blog_posts.
-- Fictional articles only. Post 1 and 2 are published, 3 is a draft, 4 archived, 5 in Trash. The words "secretword",
-- "archivedword" and "trashedword" are in the three that no visitor may find.
begin;
select plan(71);

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', '919000000001', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());
insert into public.content_categories (id, module, slug, name) values
  ('00000000-0000-4000-c500-000000000001', 'blog', 'buying', 'Buying'),
  ('00000000-0000-4000-c500-000000000002', 'faq', 'pricing', 'Pricing');
insert into public.blog_posts (
  id, slug, title, excerpt, body, tags, category_id, author_name, status, published_at, deleted_at
) values
  ('00000000-0000-4000-c500-0000000000a1', 'guide-to-buying-a-flat', 'Guide to buying a flat', 'How to buy your first flat.',
   '[{"type": "heading", "level": 2, "text": "Before you pay"},
     {"type": "paragraph", "text": "Check the registration charges and the title deed."},
     {"type": "list", "ordered": false, "items": ["Ask for the sale deed", "Ask for the tax receipts"]}]',
   array['buying', 'chennai'], '00000000-0000-4000-c500-000000000001', 'Asha Rao', 'published', '2026-03-01 10:00:00+00', null),
  ('00000000-0000-4000-c500-0000000000a2', 'renting-tips', 'Renting tips', 'Read the lease before you sign.',
   '[{"type": "paragraph", "text": "Tenants should read the lease twice."},
     {"type": "quote", "text": "Never pay cash without a receipt.", "cite": "A landlord"}]',
   array['rent'], null, 'Asha Rao', 'published', '2026-01-01 10:00:00+00', null),
  ('00000000-0000-4000-c500-0000000000a3', 'draft-post', 'A draft', '',
   '[{"type": "paragraph", "text": "secretword is only in the draft."}]',
   '{}', null, 'Asha Rao', 'draft', null, null),
  ('00000000-0000-4000-c500-0000000000a4', 'old-news', 'Old news', 'An archived article.',
   '[{"type": "paragraph", "text": "archivedword was news once."}]',
   '{}', null, 'Asha Rao', 'archived', '2025-01-01 10:00:00+00', null),
  ('00000000-0000-4000-c500-0000000000a5', 'trashed-post', 'In the bin', '',
   '[{"type": "paragraph", "text": "trashedword was thrown away."}]',
   '{}', null, 'Asha Rao', 'draft', null, now());

-- The same columns for a visitor and a signed-in person (ADR-017), checked here for every column of the table.
select is(
  (select string_agg(attribute.attname::text, ',' order by attribute.attname::text)
   from pg_attribute as attribute
   where attribute.attrelid = 'public.blog_posts'::regclass and attribute.attnum > 0
     and not attribute.attisdropped and has_column_privilege('anon', attribute.attrelid, attribute.attname, 'select')),
  (select string_agg(attribute.attname::text, ',' order by attribute.attname::text)
   from pg_attribute as attribute
   where attribute.attrelid = 'public.blog_posts'::regclass and attribute.attnum > 0
     and not attribute.attisdropped
     and has_column_privilege('authenticated', attribute.attrelid, attribute.attname, 'select')),
  'a visitor and a signed-in person read the same columns of blog_posts'
);

-- DB-RLS-blog_posts: a visitor reads only what is published and not in Trash, and writes nothing
set local role anon;
select is(
  (select count(*) from public.blog_posts)::int,
  2,
  'a visitor sees the two published articles'
);
select set_eq(
  $$select slug from public.blog_posts$$,
  $$values ('guide-to-buying-a-flat'), ('renting-tips')$$,
  'and not the draft, the archived one or the one in Trash'
);
select is_empty(
  $$select 1 from public.blog_posts where slug in ('draft-post', 'old-news', 'trashed-post')$$,
  'a visitor cannot ask for them by address either'
);
select is(
  (select count(*) from public.blog_posts where deleted_at is not null)::int,
  0,
  'a visitor never sees an article that has a Trash date'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name) values ('visitor-post', 'Visitor post', 'Visitor')$$,
  '42501',
  null,
  'a visitor cannot add an article'
);
select throws_ok(
  $$update public.blog_posts set title = 'Hacked'$$,
  '42501',
  null,
  'a visitor cannot change an article'
);
select lives_ok(
  $$select public.blog_body_text('[]'::jsonb)$$,
  'a visitor can run the plain-text helper the search uses'
);
select throws_ok(
  $$select public.blog_body_is_valid('[]'::jsonb)$$,
  '42501',
  null,
  'but not the checks that guard a write'
);
reset role;

-- A customer reads the same and cannot write
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919000000001"}',
  true
);
select is(
  (select count(*) from public.blog_posts)::int,
  2,
  'a customer sees only the two published articles'
);
select lives_ok(
  $$update public.blog_posts set title = 'Hacked' where slug = 'renting-tips'$$,
  'a customer update is accepted but matches no rows'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name) values ('customer-post', 'Customer post', 'Customer')$$,
  '42501',
  null,
  'a customer cannot add an article'
);
select throws_ok(
  $$delete from public.blog_posts where slug = 'renting-tips'$$,
  '42501',
  null,
  'a customer cannot delete an article'
);
reset role;
select is(
  (select title from public.blog_posts where slug = 'renting-tips'),
  'Renting tips',
  'the article is unchanged after the customer update'
);

-- The super admin reads all and writes, and still cannot delete
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
select is(
  (select count(*) from public.blog_posts)::int,
  5,
  'the super admin sees every article, Trash too'
);
select lives_ok(
  $$insert into public.blog_posts (slug, title, excerpt, author_name, category_id, tags)
    values ('new-guide', 'A new guide', 'Short.', 'Asha Rao',
            '00000000-0000-4000-c500-000000000001', array['guide'])$$,
  'the super admin can add an article'
);
select lives_ok(
  $$update public.blog_posts set title = 'A better guide', excerpt = 'Shorter.' where slug = 'new-guide'$$,
  'the super admin can edit an article'
);
select lives_ok(
  $$update public.blog_posts set deleted_at = now() where slug = 'new-guide'$$,
  'the super admin can move an article to Trash'
);
select lives_ok(
  $$update public.blog_posts set deleted_at = null where slug = 'new-guide'$$,
  'and restore it'
);
select throws_ok(
  $$delete from public.blog_posts where slug = 'new-guide'$$,
  '42501',
  null,
  'nobody holds the delete privilege: Trash is an update'
);
select throws_ok(
  $$update public.blog_posts set published_at = now() where slug = 'new-guide'$$,
  '42501',
  null,
  'the publish date is the database''s, not a column the admin writes'
);
reset role;

-- DB-CON-blog_posts
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name) values ('Bad Slug', 'Bad slug post', 'A Writer')$$,
  '23514', null, 'a slug is lowercase words joined by hyphens'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name) values ('renting-tips', 'Same slug', 'A Writer')$$,
  '23505', null, 'a slug is used once'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name) values ('short-title', 'No', 'A Writer')$$,
  '23514', null, 'a title has at least three characters'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name) values ('no-author', 'No author here', ' ')$$,
  '23514', null, 'an author name cannot be blank'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, status) values ('odd-status', 'Odd status here', 'A Writer', 'scheduled')$$,
  '23514', null, 'a status is draft, published or archived'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('not-array', 'Body not an array', 'A Writer', '{"type": "paragraph"}')$$,
  '23514', null, 'a body is an array of blocks'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('html-block', 'Body with a script', 'A Writer', '[{"type": "html", "text": "<b>x</b>"}]')$$,
  '23514', null, 'a block of an unknown type, such as raw HTML, is refused'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('extra-key', 'Block with an extra key', 'A Writer', '[{"type": "paragraph", "text": "Hi", "style": "x"}]')$$,
  '23514', null, 'a block with a key its type does not have is refused'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('deep-heading', 'Heading too deep', 'A Writer', '[{"type": "heading", "level": 4, "text": "Deep"}]')$$,
  '23514', null, 'a heading is level 2 or 3'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('empty-list', 'List with nothing', 'A Writer', '[{"type": "list", "ordered": true, "items": []}]')$$,
  '23514', null, 'a list has at least one item'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('bad-image', 'Image from elsewhere', 'A Writer', '[{"type": "image", "path": "https://example.test/x.png", "alt": "A flat"}]')$$,
  '23514', null, 'an image is a file of the blog folder, not an address'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('no-alt', 'Image without alt', 'A Writer', '[{"type": "image", "path": "blog/00000000-0000-4000-c500-0000000000a1/a1.webp", "alt": " "}]')$$,
  '23514', null, 'an image needs its description'
);
select lives_ok(
  $$insert into public.blog_posts (slug, title, author_name, body) values ('good-image', 'Image with a description', 'A Writer', '[{"type": "image", "path": "blog/00000000-0000-4000-c500-0000000000a1/a1.webp", "alt": "A bright flat", "caption": "The living room"}]')$$,
  'a good image block is accepted'
);
select throws_ok(
  format(
    $$insert into public.blog_posts (slug, title, author_name, body) values ('too-many', 'Too many blocks', 'A Writer', %L)$$,
    (select jsonb_agg('{"type": "paragraph", "text": "x"}'::jsonb)::text from generate_series(1, 101))
  ),
  '23514', null, 'a body has at most 100 blocks'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, tags) values ('big-tag', 'Tag in capitals', 'A Writer', array['Capital'])$$,
  '23514', null, 'a tag is lowercase words joined by hyphens'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, tags)
    values ('many-tags', 'Eleven tags here', 'A Writer', array['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj', 'kk'])$$,
  '23514', null, 'an article has at most ten tags'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, cover_path)
    values ('cover-no-alt', 'Cover without alt', 'A Writer', 'blog/00000000-0000-4000-c500-0000000000a1/cover.webp')$$,
  '23514', null, 'a cover picture needs its description'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, cover_path, cover_alt)
    values ('cover-svg', 'Cover as a drawing', 'A Writer', 'blog/00000000-0000-4000-c500-0000000000a1/cover.svg', 'A drawing')$$,
  '23514', null, 'a cover picture is a PNG, JPG or WEBP in the blog folder'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, status, excerpt, body)
    values ('empty-published', 'Published and empty', 'A Writer', 'published', 'A summary.', '[]')$$,
  '23514', null, 'a published article has a body'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, status, excerpt, body)
    values ('no-excerpt', 'Published without summary', 'A Writer', 'published', '', '[{"type": "paragraph", "text": "Hi"}]')$$,
  '23514', null, 'a published article has an excerpt'
);
select throws_ok(
  $$update public.blog_posts set deleted_at = now() where slug = 'renting-tips'$$,
  '23514', null, 'a published article is unpublished before it goes to Trash'
);
select throws_ok(
  $$insert into public.blog_posts (slug, title, author_name, category_id)
    values ('wrong-category', 'In a question category', 'A Writer', '00000000-0000-4000-c500-000000000002')$$,
  '23514', null, 'the category must be a Blog category'
);
select throws_ok(
  $$delete from public.content_categories where id = '00000000-0000-4000-c500-000000000001'$$,
  '23503', null, 'a category with articles cannot be deleted'
);

-- Generated columns and the publish date
select is(
  (select read_minutes from public.blog_posts where slug = 'renting-tips'),
  1,
  'a short article reads in one minute'
);
insert into public.blog_posts (slug, title, author_name, body)
values ('long-read', 'A very long read', 'A Writer', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'text', repeat('word ', 450))));
select is(
  (select read_minutes from public.blog_posts where slug = 'long-read'),
  3,
  'about 200 words a minute: 450 words take three minutes'
);
select ok(
  (select search_vector @@ pg_catalog.to_tsquery('simple', 'registration & chennai & flat')
   from public.blog_posts where slug = 'guide-to-buying-a-flat'),
  'the search vector holds the title, the body and the tags'
);
select ok(
  not (select search_vector @@ pg_catalog.to_tsquery('simple', 'registration')
       from public.blog_posts where slug = 'renting-tips'),
  'and only the words of its own article'
);
update public.blog_posts set status = 'published', excerpt = 'Now ready.',
  body = '[{"type": "paragraph", "text": "Ready to read."}]' where slug = 'draft-post';
select ok(
  (select published_at is not null from public.blog_posts where slug = 'draft-post'),
  'publishing stamps the publish date'
);
create temp table first_date as select published_at from public.blog_posts where slug = 'draft-post';
update public.blog_posts set status = 'draft' where slug = 'draft-post';
update public.blog_posts set status = 'published' where slug = 'draft-post';
select is(
  (select published_at from public.blog_posts where slug = 'draft-post'),
  (select published_at from first_date),
  'unpublishing and publishing again keeps the first publish date'
);
update public.blog_posts set status = 'draft', body = '[{"type": "paragraph", "text": "secretword is only in the draft."}]'
  where slug = 'draft-post';

-- DB-AUDIT-content: the id and the names of changed columns, never the text
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_type = 'blog_post'
      and entity_id = (select id::text from public.blog_posts where slug = 'new-guide')
      and diff = '{"change": "created", "module": "blog"}'::jsonb
  ),
  'adding an article is recorded'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_id = (select id::text from public.blog_posts where slug = 'new-guide')
      and diff = '{"change": "updated", "module": "blog", "columns": ["excerpt", "title"]}'::jsonb
  ),
  'changing an article records the changed column names, not their values or the derived columns'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'content.changed' and entity_id = (select id::text from public.blog_posts where slug = 'new-guide')
      and diff = '{"change": "updated", "module": "blog", "columns": ["deleted_at"]}'::jsonb
  ),
  'moving an article to Trash and back is recorded'
);
select is(
  (select count(*) from public.audit_log
   where entity_id = (select id::text from public.blog_posts where slug = 'new-guide') and diff::text like '%A better guide%'),
  0::bigint,
  'the title text is never in the audit entry'
);
create temp table audit_mark (total bigint);
insert into audit_mark select count(*) from public.audit_log;
update public.blog_posts set title = 'A better guide' where slug = 'new-guide';
select is(
  (select count(*) from public.audit_log),
  (select total from audit_mark),
  'saving an article with the same values is not recorded'
);

-- DB-FN-search_blog_posts: the visitor's search
set local role anon;
select is(
  (select count(*) from public.search_blog_posts('registration'))::int,
  1,
  'a word in the body finds the article'
);
select is(
  (select slug from public.search_blog_posts('registration')),
  'guide-to-buying-a-flat',
  'and it is the right one'
);
select ok(
  (select snippet like '%[[registration]]%' from public.search_blog_posts('registration')),
  'the snippet marks the matched word'
);
select is(
  (select total_count from public.search_blog_posts('registration')),
  1::bigint,
  'every row carries the total'
);
select is(
  (select count(*) from public.search_blog_posts('secretword'))::int,
  0,
  'a word only in a draft finds nothing'
);
select is(
  (select count(*) from public.search_blog_posts('archivedword'))::int,
  0,
  'a word only in an archived article finds nothing'
);
select is(
  (select count(*) from public.search_blog_posts('trashedword'))::int,
  0,
  'a word only in an article in Trash finds nothing'
);
select is(
  (select slug from public.search_blog_posts('tenants lease')),
  'renting-tips',
  'several words must all be there'
);
select is(
  (select array_agg(slug order by published_at desc) from public.search_blog_posts()),
  array['guide-to-buying-a-flat', 'renting-tips'],
  'with no words, every published article, newest first'
);
select is(
  (select slug from public.search_blog_posts(p_category => 'buying')),
  'guide-to-buying-a-flat',
  'a category slug narrows the list'
);
select is(
  (select category_name from public.search_blog_posts(p_category => 'buying')),
  'Buying',
  'and the category name comes with the row'
);
select is(
  (select count(*) from public.search_blog_posts(p_category => 'pricing'))::int,
  0,
  'a slug that is not a Blog category finds nothing'
);
select is(
  (select slug from public.search_blog_posts(p_tag => 'rent')),
  'renting-tips',
  'a tag narrows the list'
);
select is(
  (select slug from public.search_blog_posts(p_limit => 1, p_offset => 1)),
  'renting-tips',
  'a page is a limit and an offset'
);
select is(
  (select total_count from public.search_blog_posts(p_limit => 1, p_offset => 1)),
  2::bigint,
  'and the total is the count before the page'
);
select is(
  (select count(*) from public.search_blog_posts(p_limit => 0))::int,
  1,
  'a limit below one is raised to one'
);
reset role;

select * from finish();
rollback;
