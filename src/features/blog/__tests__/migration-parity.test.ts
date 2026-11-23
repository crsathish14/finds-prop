import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOCKS_BYTES_MAX,
  BLOCKS_MAX,
  BLOCK_TYPES,
  BLOG_ALT_MAX,
  BLOG_AUTHOR_MAX,
  BLOG_CAPTION_MAX,
  BLOG_EXCERPT_MAX,
  BLOG_IMAGE_PATH,
  BLOG_SEO_DESCRIPTION_MAX,
  BLOG_SEO_TITLE_MAX,
  BLOG_SLUG_MAX,
  BLOG_STATUSES,
  BLOG_TAGS_MAX,
  BLOG_TAG_MAX_LENGTH,
  BLOG_TITLE_MAX,
  HEADING_MAX,
  LIST_ITEMS_MAX,
  LIST_ITEM_MAX,
  PARAGRAPH_MAX,
  QUOTE_CITE_MAX,
  QUOTE_MAX,
} from "../constants";

/**
 * The table checks the same limits as the form (ADR-144), so a bad row cannot be stored by any route. This reads the
 * migration as text and fails when a limit here and a limit there drift apart: a change to either needs a new
 * migration and a change to the other.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20261120110000_blog_posts.sql"),
  "utf8",
);

describe("UT-blog-migration-parity: the form's limits are the table's", () => {
  it.each([
    ["the title", `char_length(btrim(title)) between 3 and ${BLOG_TITLE_MAX}`],
    ["the slug", `char_length(slug) between 2 and ${BLOG_SLUG_MAX}`],
    ["the excerpt", `char_length(excerpt) <= ${BLOG_EXCERPT_MAX}`],
    ["the author", `char_length(btrim(author_name)) between 2 and ${BLOG_AUTHOR_MAX}`],
    ["the search title", `char_length(btrim(seo_title)) between 1 and ${BLOG_SEO_TITLE_MAX}`],
    [
      "the search description",
      `char_length(btrim(seo_description)) between 1 and ${BLOG_SEO_DESCRIPTION_MAX}`,
    ],
    ["the cover description", `char_length(btrim(cover_alt)) between 1 and ${BLOG_ALT_MAX}`],
    ["the number of blocks", `jsonb_array_length(blocks) <= ${BLOCKS_MAX}`],
    ["the body size", `octet_length(blocks::text) <= ${BLOCKS_BYTES_MAX}`],
    ["the number of tags", `cardinality(post_tags) <= ${BLOG_TAGS_MAX}`],
    ["the tag length", `char_length(tag) not between 2 and ${BLOG_TAG_MAX_LENGTH}`],
    ["a heading", `char_length(btrim(block ->> 'text')) between 1 and ${HEADING_MAX}`],
    ["a paragraph", `char_length(btrim(block ->> 'text')) between 1 and ${PARAGRAPH_MAX}`],
    ["a quote", `char_length(btrim(block ->> 'text')) between 1 and ${QUOTE_MAX}`],
    ["a quote's credit", `char_length(btrim(block ->> 'cite')) between 1 and ${QUOTE_CITE_MAX}`],
    ["an image's description", `char_length(btrim(block ->> 'alt')) between 1 and ${BLOG_ALT_MAX}`],
    [
      "an image's caption",
      `char_length(btrim(block ->> 'caption')) between 1 and ${BLOG_CAPTION_MAX}`,
    ],
    [
      "the number of list items",
      `jsonb_array_length(block -> 'items') between 1 and ${LIST_ITEMS_MAX}`,
    ],
    ["a list item", `char_length(btrim(item.entry #>> '{}')) not between 1 and ${LIST_ITEM_MAX}`],
  ])("holds %s to the same limit", (_name, fragment) => {
    expect(SQL).toContain(fragment);
  });

  it("names the same statuses and the same kinds of block", () => {
    expect(SQL).toContain(`status in (${BLOG_STATUSES.map((status) => `'${status}'`).join(", ")})`);
    for (const type of BLOCK_TYPES) expect(SQL).toContain(`when '${type}' then`);
  });

  it("checks the same picture path as the form (both the cover and an image block)", () => {
    const source = BLOG_IMAGE_PATH.source.replaceAll("\\/", "/");
    expect(SQL.split(`'${source}'`).length - 1).toBe(2);
  });
});
