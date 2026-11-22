-- ADR-169 inline links in blog articles. Tests: DB-FN-blog_body_text-links, DB-CON-blog_block_is_valid-links.
-- The strings below are the same vectors as src/features/blog/__tests__/blog-links.test.ts: the database function and
-- blocksToPlainText are one function. Nothing is stored except one fictional article inside the transaction.
begin;
select plan(24);

-- The plain text strips each allowed link to its label (paragraph, quote and list item) and leaves the rest.
select is(
  public.blog_body_text('[{"type": "paragraph", "text": "Read [the guide](https://example.com/a?b=1) now"}]'::jsonb),
  'Read the guide now',
  'a paragraph link becomes its label'
);
select is(
  public.blog_body_text('[{"type": "quote", "text": "Go [home](/) or [search](/properties?city=chennai)."}]'::jsonb),
  'Go home or search.',
  'a quote reads both kinds of link'
);
select is(
  public.blog_body_text('[{"type": "list", "ordered": false, "items": ["Read [the guide](https://example.com/a?b=1) now", "end"]}]'::jsonb),
  'Read the guide now end',
  'each list item is read the same way'
);
select is(
  public.blog_body_text('[{"type": "paragraph", "text": "[bad](http://example.com) stays"}]'::jsonb),
  '[bad](http://example.com) stays',
  'an address that is not https stays as typed'
);
select is(
  public.blog_body_text('[{"type": "paragraph", "text": "[x](//evil.example) stays"}]'::jsonb),
  '[x](//evil.example) stays',
  'a protocol-relative address stays as typed'
);
select is(
  public.blog_body_text('[{"type": "paragraph", "text": "[a [b](https://e.example)"}]'::jsonb),
  '[a b',
  'nested brackets read the inner link only'
);
select is(
  public.blog_body_text('[{"type": "paragraph", "text": "no links [1] and (two)"}]'::jsonb),
  'no links [1] and (two)',
  'brackets that are not a link are untouched'
);
select is(
  public.blog_body_text('[{"type": "heading", "level": 2, "text": "[a](https://b.example)"}]'::jsonb),
  '[a](https://b.example)',
  'a heading is never read as a link'
);
select is(
  public.blog_body_text('[{"type": "quote", "text": "Hi", "cite": "[a](https://b.example)"},
    {"type": "image", "path": "blog/00000000-0000-4000-b500-0000000000a1/x.webp", "alt": "[c](/d)", "caption": "[e](/f)"}]'::jsonb),
  'Hi [a](https://b.example) [e](/f) [c](/d)',
  'a credit, a caption and a description are never read as links'
);
select is(
  public.blog_body_text('[{"type": "paragraph", "text": "Plain words only."}]'::jsonb),
  'Plain words only.',
  'text with no link reads exactly as before'
);

-- The block check accepts allowed links and refuses a link-shaped piece that is not one.
select ok(
  public.blog_block_is_valid('{"type": "paragraph", "text": "See [a](https://example.com/x) and [b](/c)"}'::jsonb),
  'a paragraph with allowed links is valid'
);
select ok(
  public.blog_block_is_valid('{"type": "list", "ordered": true, "items": ["[a](/b)", "plain"]}'::jsonb),
  'a list with an allowed link is valid'
);
select ok(
  public.blog_block_is_valid('{"type": "quote", "text": "[a](https://a.example)"}'::jsonb),
  'a quote with an allowed link is valid'
);
select ok(
  not public.blog_block_is_valid('{"type": "paragraph", "text": "[x](http://example.com)"}'::jsonb),
  'a paragraph link that is not https is refused'
);
select ok(
  not public.blog_block_is_valid('{"type": "paragraph", "text": "[x](javascript:alert(1))"}'::jsonb),
  'a javascript address is refused'
);
select ok(
  not public.blog_block_is_valid('{"type": "paragraph", "text": "[x](//evil.example)"}'::jsonb),
  'a protocol-relative address is refused'
);
select ok(
  not public.blog_block_is_valid('{"type": "paragraph", "text": "see [note](below)"}'::jsonb),
  'link-shaped text that goes nowhere is refused'
);
select ok(
  not public.blog_block_is_valid('{"type": "paragraph", "text": "[](https://example.com)"}'::jsonb),
  'an empty label is refused'
);
select ok(
  not public.blog_block_is_valid('{"type": "paragraph", "text": "[a (b)](https://example.com)"}'::jsonb),
  'a label with a parenthesis is refused'
);
select ok(
  not public.blog_block_is_valid(
    jsonb_build_object('type', 'paragraph', 'text', '[x](https://example.com/' || repeat('a', 2000) || ')')
  ),
  'an address over 2,000 characters is refused'
);
select ok(
  not public.blog_block_is_valid('{"type": "list", "ordered": false, "items": ["fine", "[x](http://example.com)"]}'::jsonb),
  'a list item link that is not https is refused'
);
select ok(
  public.blog_block_is_valid('{"type": "heading", "level": 2, "text": "[x](http://example.com)"}'::jsonb),
  'a heading is not read as a link, so it is not refused'
);

-- The search vector and the reading time follow the plain text: an address is not searchable.
insert into public.blog_posts (id, slug, title, excerpt, body, author_name, status, published_at)
values (
  '00000000-0000-4000-b500-0000000000a1', 'link-article', 'Link article', 'About links.',
  '[{"type": "paragraph", "text": "Read [the registration guide](https://uniqueaddressword.example/page) today"}]',
  'Asha Rao', 'published', now()
);
select is(
  (select count(*) from public.blog_posts where search_vector @@ pg_catalog.to_tsquery('simple', 'registration')),
  1::bigint,
  'a word of the label is found'
);
select is(
  (select count(*) from public.blog_posts where search_vector @@ pg_catalog.to_tsquery('simple', 'uniqueaddressword')),
  0::bigint,
  'a word of the address is not found'
);

select * from finish();
rollback;
