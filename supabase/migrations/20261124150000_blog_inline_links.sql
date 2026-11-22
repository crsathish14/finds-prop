-- ADR-169 (amends ADR-144): one inline link, [label](address), in the text of a paragraph, a list item and a quote.
-- Everything stored stays plain text. This changes two functions and nothing else (no table, policy, grant or column):
--   * blog_body_text turns each link into its label, so the search vector, the reading time and the search snippet
--     never see an address (the application's blocksToPlainText does the same; a test reads this file and compares
--     the two patterns);
--   * blog_block_is_valid refuses a link-shaped piece of text that is not an allowed link (the form refuses it too,
--     with words that say why): an address must be https:// with a dotted host, or a path of the site starting with
--     one slash; at most 2,000 characters; a label of 1 to 160 characters with no [ ] ( ) in it. A heading's text, a
--     quote's credit and a caption are never read as links.
-- The pattern uses only what PostgreSQL's and JavaScript's regular expressions share (src/lib/inline-links.ts).
-- A body is only checked when it is written, so a stored row that holds link-shaped text from before is not refused
-- here. The rows that hold the characters ]( are written again in place so their generated search vector and reading
-- time are computed by the new function (updated_at is kept; the audit trigger sees no change and stays quiet).
-- Rollback note: nothing is dropped. Fix forward with a new migration that restores the two bodies of ADR-144.

create or replace function public.blog_body_text(blocks jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(string_agg(part.piece, ' ' order by block.block_number, part.part_number), '')
  from jsonb_array_elements(case when jsonb_typeof(blocks) = 'array' then blocks else '[]'::jsonb end)
    with ordinality as block (block_value, block_number)
  cross join lateral (
    select 0 as part_number,
      case when block.block_value ->> 'type' in ('paragraph', 'quote')
        then pg_catalog.regexp_replace(block.block_value ->> 'text', '\[([^ \t\[\]()\r\n][^\[\]()\r\n]{0,159})\]\((https://[!#-&*-;=?-Z_a-z~]+|/(?:[!#-&*-.0-;=?-Z_a-z~][!#-&*-;=?-Z_a-z~]*)?)\)', '\1', 'g')
        else block.block_value ->> 'text' end as piece
    union all select 1, block.block_value ->> 'cite'
    union all select 2, block.block_value ->> 'caption'
    union all select 3, block.block_value ->> 'alt'
    union all
    select 4 + item.item_number::integer, pg_catalog.regexp_replace(item.item_text, '\[([^ \t\[\]()\r\n][^\[\]()\r\n]{0,159})\]\((https://[!#-&*-;=?-Z_a-z~]+|/(?:[!#-&*-.0-;=?-Z_a-z~][!#-&*-;=?-Z_a-z~]*)?)\)', '\1', 'g')
    from jsonb_array_elements_text(
      case when jsonb_typeof(block.block_value -> 'items') = 'array'
        then block.block_value -> 'items' else '[]'::jsonb end
    ) with ordinality as item (item_text, item_number)
  ) as part
  where part.piece is not null
$$;

create or replace function public.blog_block_is_valid(block jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    case when jsonb_typeof(block) <> 'object' then false else
      case block ->> 'type'
        when 'heading' then
          (block - array['type', 'level', 'text']) = '{}'::jsonb
          and jsonb_typeof(block -> 'level') = 'number' and (block ->> 'level') in ('2', '3')
          and jsonb_typeof(block -> 'text') = 'string'
          and char_length(btrim(block ->> 'text')) between 1 and 160
        when 'paragraph' then
          (block - array['type', 'text']) = '{}'::jsonb
          and jsonb_typeof(block -> 'text') = 'string'
          and char_length(btrim(block ->> 'text')) between 1 and 5000
          and not exists (
            select 1 from regexp_matches(block ->> 'text', '\[([^\[\]]*)\]\(([^)]*)\)', 'g') as link (part)
            where not (
              link.part[1] ~ '^[^ \t\[\]()\r\n][^\[\]()\r\n]{0,159}$'
              and char_length(link.part[2]) <= 2000
              and (link.part[2] ~ '^https://[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]{1,5})?([/?#][!#-&*-;=?-Z_a-z~]*)?$'
                or link.part[2] ~ '^/([!#-&*-.0-;=?-Z_a-z~][!#-&*-;=?-Z_a-z~]*)?$')
            )
          )
        when 'list' then
          (block - array['type', 'ordered', 'items']) = '{}'::jsonb
          and jsonb_typeof(block -> 'ordered') = 'boolean'
          and case when jsonb_typeof(block -> 'items') = 'array' then
            jsonb_array_length(block -> 'items') between 1 and 50
            and not exists (
              select 1 from jsonb_array_elements(block -> 'items') as item (entry)
              where jsonb_typeof(item.entry) <> 'string'
                or char_length(btrim(item.entry #>> '{}')) not between 1 and 500
                or exists (
                  select 1 from regexp_matches(item.entry #>> '{}', '\[([^\[\]]*)\]\(([^)]*)\)', 'g') as link (part)
                  where not (
                    link.part[1] ~ '^[^ \t\[\]()\r\n][^\[\]()\r\n]{0,159}$'
                    and char_length(link.part[2]) <= 2000
                    and (link.part[2] ~ '^https://[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]{1,5})?([/?#][!#-&*-;=?-Z_a-z~]*)?$'
                      or link.part[2] ~ '^/([!#-&*-.0-;=?-Z_a-z~][!#-&*-;=?-Z_a-z~]*)?$')
                  )
                )
            )
          else false end
        when 'quote' then
          (block - array['type', 'text', 'cite']) = '{}'::jsonb
          and jsonb_typeof(block -> 'text') = 'string'
          and char_length(btrim(block ->> 'text')) between 1 and 1000
          and not exists (
            select 1 from regexp_matches(block ->> 'text', '\[([^\[\]]*)\]\(([^)]*)\)', 'g') as link (part)
            where not (
              link.part[1] ~ '^[^ \t\[\]()\r\n][^\[\]()\r\n]{0,159}$'
              and char_length(link.part[2]) <= 2000
              and (link.part[2] ~ '^https://[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]{1,5})?([/?#][!#-&*-;=?-Z_a-z~]*)?$'
                or link.part[2] ~ '^/([!#-&*-.0-;=?-Z_a-z~][!#-&*-;=?-Z_a-z~]*)?$')
            )
          )
          and (not jsonb_exists(block, 'cite') or (jsonb_typeof(block -> 'cite') = 'string'
            and char_length(btrim(block ->> 'cite')) between 1 and 120))
        when 'image' then
          (block - array['type', 'path', 'alt', 'caption']) = '{}'::jsonb
          and jsonb_typeof(block -> 'path') = 'string'
          and (block ->> 'path') ~ '^blog/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]{1,40}\.(png|jpg|webp)$'
          and jsonb_typeof(block -> 'alt') = 'string'
          and char_length(btrim(block ->> 'alt')) between 1 and 200
          and (not jsonb_exists(block, 'caption') or (jsonb_typeof(block -> 'caption') = 'string'
            and char_length(btrim(block ->> 'caption')) between 1 and 200))
        else false
      end
    end,
    false
  )
$$;

alter table public.blog_posts disable trigger blog_posts_updated_at;
update public.blog_posts set body = body where body::text like '%](%';
alter table public.blog_posts enable trigger blog_posts_updated_at;
