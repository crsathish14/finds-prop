import { z } from "zod";
import {
  BLOCKS_BYTES_MAX,
  BLOCKS_MAX,
  BLOG_ALT_MAX,
  BLOG_AUTHOR_MAX,
  BLOG_AUTHOR_MIN,
  BLOG_CAPTION_MAX,
  BLOG_EXCERPT_MAX,
  BLOG_IMAGE_PATH,
  BLOG_SEO_DESCRIPTION_MAX,
  BLOG_SEO_TITLE_MAX,
  BLOG_SLUG_MAX,
  BLOG_SLUG_MIN,
  BLOG_TAGS_MAX,
  BLOG_TAG_MAX_LENGTH,
  BLOG_TAG_MIN,
  BLOG_TITLE_MAX,
  BLOG_TITLE_MIN,
  HEADING_MAX,
  LIST_ITEMS_MAX,
  LIST_ITEM_MAX,
  PARAGRAPH_MAX,
  QUOTE_CITE_MAX,
  QUOTE_MAX,
} from "./constants";
import { findLinkProblem } from "@/lib/inline-links";
import { tagFromText } from "./slug";

/**
 * What the Blog's admin sends (ADR-143, ADR-144) and the shape of an article body. Nothing here says who is saving or
 * what an article's status is: the admin is the signed-in session and each status change is its own action (R-BE-03).
 * A schema message is a key under `validation.*`; the screen looks the words up (ADR-035). The limits match the
 * `blog_posts` table's checks, so the database only refuses what the form could not see (a slug already used). Zod only:
 * the browser's editor and the server's action use the same schemas.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** Typed text: surrounding spaces and runs of spaces or tabs are tidied (line breaks stay). */
const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

const plain = (min: number, max: number) =>
  z.preprocess(
    tidy,
    z
      .string({ error: "validation.required" })
      .min(min, { error: "validation.required" })
      .max(max, { error: "validation.invalid" }),
  );

/**
 * Text that may hold `[label](address)` links (ADR-169): a link-shaped piece that is not an allowed link (an address that
 * is not https or a path of this site, a label with brackets, an address over 2,000 characters) is refused with words
 * that say which, instead of being saved as text that looks like a link and is not one.
 */
const LINK_MESSAGES = {
  label: "validation.blogLinkLabel",
  address: "validation.blogLinkAddress",
  tooLong: "validation.blogLinkTooLong",
} as const;
const linked = (min: number, max: number) =>
  plain(min, max).superRefine((text, context) => {
    const problem = findLinkProblem(text);
    if (problem !== null) context.addIssue({ code: "custom", message: LINK_MESSAGES[problem] });
  });

/** An optional piece of a block (a quote's credit, a caption): empty means "none". */
const optionalPart = (max: number) =>
  z.preprocess(
    (typed) => (tidy(typed) === "" ? undefined : tidy(typed)),
    z
      .string({ error: "validation.invalid" })
      .min(1, { error: "validation.invalid" })
      .max(max, { error: "validation.invalid" })
      .optional(),
  );

/** An optional text box of the form: empty means "none" (stored as null). */
const optional = (max: number) =>
  z.preprocess(
    (typed) => {
      const tidied = tidy(typed);
      return tidied === "" || tidied === undefined ? null : tidied;
    },
    z.string({ error: "validation.invalid" }).max(max, { error: "validation.invalid" }).nullable(),
  );

/**
 * The blocks of an article body. Each has exactly the keys of its type: an unknown key or type is refused. Made twice from
 * one description: with `linked` text for what the admin saves (a link-shaped piece that is not allowed is refused), and
 * with plain text for what is read back, so an article saved before links existed that happens to hold something like
 * `[note](below)` still opens and draws as it always did.
 */
function buildBlocks(text: typeof plain) {
  const heading = z.strictObject({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)], { error: "validation.invalid" }),
    text: plain(1, HEADING_MAX),
  });
  const paragraph = z.strictObject({
    type: z.literal("paragraph"),
    text: text(1, PARAGRAPH_MAX),
  });
  const list = z.strictObject({
    type: z.literal("list"),
    ordered: z.boolean({ error: "validation.invalid" }),
    items: z
      .array(text(1, LIST_ITEM_MAX), { error: "validation.invalid" })
      .min(1, { error: "validation.required" })
      .max(LIST_ITEMS_MAX, { error: "validation.invalid" }),
  });
  const quote = z.strictObject({
    type: z.literal("quote"),
    text: text(1, QUOTE_MAX),
    cite: optionalPart(QUOTE_CITE_MAX),
  });
  const image = z.strictObject({
    type: z.literal("image"),
    path: z
      .string({ error: "validation.invalid" })
      .regex(BLOG_IMAGE_PATH, { error: "validation.invalid" }),
    alt: plain(1, BLOG_ALT_MAX),
    caption: optionalPart(BLOG_CAPTION_MAX),
  });
  const block = z.discriminatedUnion("type", [heading, paragraph, list, quote, image], {
    error: "validation.invalid",
  });
  /** The whole body: at most 100 blocks and 100,000 bytes once stored as JSON. */
  const body = z
    .array(block, { error: "validation.invalid" })
    .max(BLOCKS_MAX, { error: "validation.invalid" })
    .refine(
      (blocks) => new TextEncoder().encode(JSON.stringify(blocks)).length <= BLOCKS_BYTES_MAX,
      { error: "validation.invalid" },
    );
  return { heading, paragraph, list, quote, image, block, body };
}

const saved = buildBlocks(linked);
export const headingBlockSchema = saved.heading;
export const paragraphBlockSchema = saved.paragraph;
export const listBlockSchema = saved.list;
export const quoteBlockSchema = saved.quote;
export const imageBlockSchema = saved.image;
export const blockSchema = saved.block;
export const bodySchema = saved.body;
/** For reading a stored body back: the same shapes, without refusing link-shaped text (ADR-169). */
export const storedBodySchema = buildBlocks(plain).body;

export type Block = z.infer<typeof blockSchema>;
export type HeadingBlock = z.infer<typeof headingBlockSchema>;
export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>;
export type ListBlock = z.infer<typeof listBlockSchema>;
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;

const slug = z
  .string({ error: "validation.blogSlugInvalid" })
  .trim()
  .min(BLOG_SLUG_MIN, { error: "validation.blogSlugInvalid" })
  .max(BLOG_SLUG_MAX, { error: "validation.blogSlugInvalid" })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.blogSlugInvalid" });

const title = plain(BLOG_TITLE_MIN, BLOG_TITLE_MAX);
const authorName = plain(BLOG_AUTHOR_MIN, BLOG_AUTHOR_MAX);

/** Typed tags become the stored shape (lower case words joined by hyphens), and a repeated one is dropped. */
const tags = z
  .array(
    z
      .string({ error: "validation.invalid" })
      .transform(tagFromText)
      .pipe(
        z
          .string()
          .min(BLOG_TAG_MIN, { error: "validation.invalid" })
          .max(BLOG_TAG_MAX_LENGTH, { error: "validation.invalid" }),
      ),
    { error: "validation.invalid" },
  )
  .max(BLOG_TAGS_MAX, { error: "validation.invalid" })
  .transform((list) => [...new Set(list)]);

/** A new article starts as a draft with an empty body: the address is made from the title unless the admin typed one. */
export const createBlogPostSchema = z.object({
  title,
  authorName,
  slug: slug.optional(),
  categoryId: uuid.nullable().default(null),
});
export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;

/** Saving the editor: everything the admin types, except the cover (its own action) and the status. */
export const updateBlogPostSchema = z.object({
  postId: uuid,
  title,
  slug,
  excerpt: z.preprocess(
    tidy,
    z
      .string({ error: "validation.invalid" })
      .max(BLOG_EXCERPT_MAX, { error: "validation.invalid" }),
  ),
  body: bodySchema,
  categoryId: uuid.nullable(),
  tags,
  authorName,
  seoTitle: optional(BLOG_SEO_TITLE_MAX),
  seoDescription: optional(BLOG_SEO_DESCRIPTION_MAX),
});
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;

/** Sets the cover picture (already in the bucket under the article's folder) with its description, or removes it. */
export const setBlogCoverSchema = z
  .object({
    postId: uuid,
    coverPath: z
      .string({ error: "validation.invalid" })
      .regex(BLOG_IMAGE_PATH, { error: "validation.invalid" })
      .nullable(),
    coverAlt: optional(BLOG_ALT_MAX),
  })
  .refine((cover) => cover.coverPath === null || cover.coverAlt !== null, {
    path: ["coverAlt"],
    error: "validation.required",
  });
export type SetBlogCoverInput = z.infer<typeof setBlogCoverSchema>;

/** The status changes and Trash take only the article's id. */
export const blogPostIdSchema = z.object({ postId: uuid });
export type BlogPostIdInput = z.infer<typeof blogPostIdSchema>;
