/**
 * The Blog's limits and fixed lists (ADR-143, ADR-144). Each limit is also a check in the `blog_posts` table, so the
 * form, the action and the database agree; a change here needs a new migration beside it.
 */
export const BLOG_STATUSES = ["draft", "published", "archived"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

/** The kinds of block an article body is made of. Nothing else is stored or drawn: no raw HTML. */
export const BLOCK_TYPES = ["heading", "paragraph", "list", "quote", "image"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOG_TITLE_MIN = 3;
export const BLOG_TITLE_MAX = 160;
export const BLOG_SLUG_MIN = 2;
export const BLOG_SLUG_MAX = 120;
export const BLOG_EXCERPT_MAX = 320;
export const BLOG_AUTHOR_MIN = 2;
export const BLOG_AUTHOR_MAX = 80;
export const BLOG_TAGS_MAX = 10;
export const BLOG_TAG_MIN = 2;
export const BLOG_TAG_MAX_LENGTH = 40;
export const BLOG_SEO_TITLE_MAX = 70;
export const BLOG_SEO_DESCRIPTION_MAX = 170;
export const BLOG_ALT_MAX = 200;
export const BLOG_CAPTION_MAX = 200;

/** The longest Markdown text the paste flow reads (ADR-172); a full article is far smaller. */
export const MARKDOWN_MAX_CHARS = 400_000;

/**
 * The name of a picture's place in pasted Markdown (ADR-173): a line `![what it shows](IMAGE-1)` marks where a picture
 * goes, and the admin chooses the file for it on the paste screen. Up to three digits, so at most 999 names.
 */
export const BLOG_PICTURE_SLOT = /^IMAGE-(\d{1,3})$/;

export const BLOCKS_MAX = 100;
export const BLOCKS_BYTES_MAX = 100_000;
export const HEADING_MAX = 160;
export const PARAGRAPH_MAX = 5000;
export const LIST_ITEMS_MAX = 50;
export const LIST_ITEM_MAX = 500;
export const QUOTE_MAX = 1000;
export const QUOTE_CITE_MAX = 120;

/** The public bucket the covers and the article pictures live in, under `blog/<post id>/` (ADR-144). */
export const BLOG_IMAGE_BUCKET = "site-assets";
/** The bucket's own cap is 500 KB; a picture is also refused above this side length. */
export const BLOG_IMAGE_MAX_BYTES = 500 * 1024;
export const BLOG_IMAGE_MAX_KB = 500;
export const BLOG_IMAGE_MAX_SIDE = 6000;

/** How many articles one page of the public list holds, and how many related articles an article shows. */
export const BLOG_PAGE_SIZE = 12;
export const BLOG_RELATED_COUNT = 3;
/** The admin's list. */
export const BLOG_ADMIN_PAGE_SIZE = 20;
/** The most tags the filter row reads from the published articles. */
export const BLOG_TAG_FILTER_MAX = 30;

/** The folder of one article's pictures, and the pattern a stored picture path must match (the table checks it too). */
export function blogImageFolder(postId: string): string {
  return `blog/${postId}/`;
}
export const BLOG_IMAGE_PATH =
  /^blog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9-]{1,40}\.(png|jpg|webp)$/;
