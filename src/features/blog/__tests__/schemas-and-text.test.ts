import { describe, expect, it } from "vitest";
import { blocksToPlainText, excerptFromBlocks, imagePathsOf, readMinutesOf } from "../body-text";
import {
  blockSchema,
  blogPostIdSchema,
  bodySchema,
  createBlogPostSchema,
  setBlogCoverSchema,
  updateBlogPostSchema,
} from "../schemas";
import type { Block } from "../schemas";
import { slugFromTitle, slugWithSuffix, slugWithTail, tagFromText } from "../slug";
import {
  pageCountOf,
  parseBody,
  snippetParts,
  toAdminPostView,
  toAdminRowView,
  toArticleView,
  toCardView,
  toListView,
  type AdminPostRow,
  type SearchRow,
} from "../view";

const POST = "00000000-0000-4000-b500-0000000000a1";
const IMAGE = `blog/${POST}/living-room.webp`;
const imageUrl = (path: string) => `https://files.example.test/${path}`;

const BODY: Block[] = [
  { type: "heading", level: 2, text: "Before you pay" },
  { type: "paragraph", text: "Check the registration charges." },
  { type: "list", ordered: false, items: ["Sale deed", "Tax receipts"] },
  { type: "quote", text: "Never pay cash.", cite: "A landlord" },
  { type: "image", path: IMAGE, alt: "A bright living room", caption: "The living room" },
];

describe("UT-blog-schemas: the block format (ADR-144)", () => {
  it("accepts each kind of block and tidies typed text", () => {
    for (const block of BODY) expect(blockSchema.safeParse(block).success).toBe(true);
    expect(blockSchema.parse({ type: "paragraph", text: "  Two   words  " })).toEqual({
      type: "paragraph",
      text: "Two words",
    });
  });

  it("drops an empty credit and an empty caption instead of keeping an empty string", () => {
    expect(blockSchema.parse({ type: "quote", text: "Hi", cite: "  " })).toEqual({
      type: "quote",
      text: "Hi",
    });
    expect(blockSchema.parse({ type: "image", path: IMAGE, alt: "A room", caption: "" })).toEqual({
      type: "image",
      path: IMAGE,
      alt: "A room",
    });
  });

  it.each([
    ["raw HTML", { type: "html", text: "<b>x</b>" }],
    ["a key the type does not have", { type: "paragraph", text: "Hi", style: "x" }],
    ["a heading that is not level 2 or 3", { type: "heading", level: 1, text: "Big" }],
    ["an empty paragraph", { type: "paragraph", text: "  " }],
    ["a list with no items", { type: "list", ordered: true, items: [] }],
    [
      "an image from another place",
      { type: "image", path: "https://example.test/x.png", alt: "x" },
    ],
    ["an image that is a drawing", { type: "image", path: `blog/${POST}/x.svg`, alt: "x" }],
    ["an image with no description", { type: "image", path: IMAGE, alt: " " }],
  ])("refuses %s", (_name, block) => {
    expect(blockSchema.safeParse(block).success).toBe(false);
  });

  it("refuses more than 100 blocks, and a body that is too heavy", () => {
    const one: Block = { type: "paragraph", text: "x" };
    expect(bodySchema.safeParse(Array.from({ length: 100 }, () => one)).success).toBe(true);
    expect(bodySchema.safeParse(Array.from({ length: 101 }, () => one)).success).toBe(false);
    const heavy: Block = { type: "paragraph", text: "x".repeat(5000) };
    expect(bodySchema.safeParse(Array.from({ length: 21 }, () => heavy)).success).toBe(false);
  });
});

describe("UT-blog-schemas: what the admin sends", () => {
  const update = {
    postId: POST.toUpperCase(),
    title: "  Guide to buying a flat ",
    slug: "guide-to-buying-a-flat",
    excerpt: "How to buy your first flat.",
    body: BODY,
    categoryId: null,
    tags: ["Home Loans", "home-loans", "Chennai"],
    authorName: "Asha Rao",
    seoTitle: "",
    seoDescription: "  ",
  };

  it("tidies an article: the id in lower case, tags as slugs without repeats, empty search fields as none", () => {
    const parsed = updateBlogPostSchema.parse(update);
    expect(parsed.postId).toBe(POST);
    expect(parsed.title).toBe("Guide to buying a flat");
    expect(parsed.tags).toEqual(["home-loans", "chennai"]);
    expect(parsed.seoTitle).toBeNull();
    expect(parsed.seoDescription).toBeNull();
  });

  it("names the box that is wrong", () => {
    const bad = updateBlogPostSchema.safeParse({ ...update, slug: "Not A Slug", tags: ["a"] });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const paths = bad.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("slug");
      expect(paths).toContain("tags.0");
      expect(bad.error.issues.find((issue) => issue.path[0] === "slug")?.message).toBe(
        "validation.blogSlugInvalid",
      );
    }
  });

  it("refuses more than ten tags and a long excerpt", () => {
    const many = Array.from({ length: 11 }, (_, index) => `tag-${index}`);
    expect(updateBlogPostSchema.safeParse({ ...update, tags: many }).success).toBe(false);
    expect(updateBlogPostSchema.safeParse({ ...update, excerpt: "x".repeat(321) }).success).toBe(
      false,
    );
  });

  it("does not take a status, an author id or a publish date from the admin's form", () => {
    const parsed = updateBlogPostSchema.parse({
      ...update,
      status: "published",
      publishedAt: "2020-01-01",
      deletedAt: null,
    });
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("publishedAt");
    expect(parsed).not.toHaveProperty("deletedAt");
  });

  it("a new article needs a title and an author; the address and the category are optional", () => {
    expect(createBlogPostSchema.parse({ title: "A new guide", authorName: "Asha Rao" })).toEqual({
      title: "A new guide",
      authorName: "Asha Rao",
      categoryId: null,
    });
    expect(createBlogPostSchema.safeParse({ title: "No", authorName: "Asha Rao" }).success).toBe(
      false,
    );
  });

  it("a cover needs its description, and removing the cover needs none", () => {
    expect(
      setBlogCoverSchema.safeParse({ postId: POST, coverPath: IMAGE, coverAlt: "" }).success,
    ).toBe(false);
    expect(
      setBlogCoverSchema.safeParse({ postId: POST, coverPath: IMAGE, coverAlt: "A flat" }).success,
    ).toBe(true);
    expect(
      setBlogCoverSchema.safeParse({ postId: POST, coverPath: null, coverAlt: null }).success,
    ).toBe(true);
  });

  it("the status actions take only an id", () => {
    expect(blogPostIdSchema.safeParse({ postId: "not-an-id" }).success).toBe(false);
    expect(blogPostIdSchema.parse({ postId: POST })).toEqual({ postId: POST });
  });
});

describe("UT-blog-text: the plain text and reading time of a body", () => {
  it("lists every piece in reading order", () => {
    expect(blocksToPlainText(BODY)).toBe(
      "Before you pay Check the registration charges. Sale deed Tax receipts Never pay cash. A landlord The living room A bright living room",
    );
  });

  it("is about 200 words a minute and never below one", () => {
    expect(readMinutesOf([])).toBe(1);
    expect(readMinutesOf(BODY)).toBe(1);
    const long: Block[] = [{ type: "paragraph", text: "word ".repeat(450).trim() }];
    expect(readMinutesOf(long)).toBe(3);
  });

  it("finds the pictures an article uses, and cuts an excerpt at a word", () => {
    expect(imagePathsOf(BODY)).toEqual([IMAGE]);
    const short = excerptFromBlocks(BODY, 40);
    expect(short.length).toBeLessThanOrEqual(40);
    expect(short.endsWith("…")).toBe(true);
    expect(excerptFromBlocks([{ type: "paragraph", text: "Short." }])).toBe("Short.");
  });
});

describe("UT-blog-slug: addresses and tags", () => {
  it("makes lower case words joined by hyphens, without accents, within the limit", () => {
    expect(slugFromTitle("Buying a Flat in Chennai: 5 Tips!")).toBe(
      "buying-a-flat-in-chennai-5-tips",
    );
    expect(slugFromTitle("Café déjà vu")).toBe("cafe-deja-vu");
    expect(slugFromTitle("தமிழ்")).toBe("");
    expect(slugFromTitle("a".repeat(200)).length).toBe(120);
    expect(tagFromText("Home Loans")).toBe("home-loans");
  });

  it("adds a number or a short tail without passing the limit", () => {
    expect(slugWithSuffix("guide", 2)).toBe("guide-2");
    expect(slugWithSuffix("a".repeat(120), 12).length).toBe(120);
    expect(slugWithTail("guide", "ab12")).toBe("guide-ab12");
    expect(slugWithTail("a".repeat(120), "ab12").length).toBe(120);
  });
});

describe("UT-blog-view: rows become the shapes the pages draw", () => {
  const row: SearchRow = {
    id: POST,
    slug: "guide",
    title: "Guide",
    excerpt: "A guide.",
    snippet: "Check the [[registration]] charges",
    cover_path: IMAGE,
    cover_alt: "A room",
    category_id: null,
    category_slug: "buying",
    category_name: "Buying",
    tags: ["chennai"],
    author_name: "Asha Rao",
    published_at: "2026-03-01T10:00:00+00:00",
    read_minutes: 2,
    total_count: 25,
  };

  it("draws a card with the cover address, the category and the snippet only when it says more than the excerpt", () => {
    const card = toCardView(row, imageUrl);
    expect(card.coverUrl).toBe(`https://files.example.test/${IMAGE}`);
    expect(card.category).toEqual({ slug: "buying", name: "Buying" });
    expect(card.snippet).toBe("Check the [[registration]] charges");
    expect(toCardView({ ...row, snippet: "A guide." }, imageUrl).snippet).toBeNull();
    expect(toCardView({ ...row, cover_path: null, category_slug: null }, imageUrl)).toMatchObject({
      coverUrl: null,
      category: null,
    });
  });

  it("counts the pages from the total on every row, and an empty list has one page", () => {
    expect(toListView([row], 2, 12, imageUrl)).toMatchObject({ total: 25, page: 2, pageCount: 3 });
    expect(toListView([], 1, 12, imageUrl)).toMatchObject({ total: 0, pageCount: 1, items: [] });
    expect(pageCountOf(24, 12)).toBe(2);
    expect(pageCountOf(25, 12)).toBe(3);
  });

  it("cuts a snippet into plain text and matched words, never into HTML", () => {
    expect(snippetParts("Check the [[registration]] and [[title]] deed")).toEqual([
      { text: "Check the ", matched: false },
      { text: "registration", matched: true },
      { text: " and ", matched: false },
      { text: "title", matched: true },
      { text: " deed", matched: false },
    ]);
    expect(snippetParts("<b>plain</b>")).toEqual([{ text: "<b>plain</b>", matched: false }]);
  });

  it("reads a stored body, and an invalid one as empty", () => {
    expect(parseBody(BODY as never)).toHaveLength(5);
    expect(parseBody([{ type: "html", text: "<b>x</b>" }] as never)).toEqual([]);
    expect(parseBody({} as never)).toEqual([]);
    expect(parseBody(null)).toEqual([]);
  });

  const adminRow: AdminPostRow = {
    id: POST,
    slug: "guide",
    title: "Guide",
    excerpt: "A guide.",
    body: BODY as never,
    cover_path: null,
    cover_alt: null,
    category_id: null,
    tags: [],
    author_name: "Asha Rao",
    status: "published",
    published_at: "2026-03-01T10:00:00+00:00",
    seo_title: null,
    seo_description: null,
    read_minutes: 1,
    updated_at: "2026-03-02T10:00:00+00:00",
    created_at: "2026-02-01T10:00:00+00:00",
    deleted_at: null,
  };

  it("draws an article page and the admin's row and editor", () => {
    expect(toArticleView(adminRow, null, imageUrl)).toMatchObject({
      slug: "guide",
      category: null,
    });
    expect(toAdminRowView({ ...adminRow, deleted_at: "2026-03-03T00:00:00+00:00" }).trashed).toBe(
      true,
    );
    expect(toAdminRowView({ ...adminRow, status: "odd" }).status).toBe("draft");
    expect(toAdminPostView(adminRow, imageUrl)).toMatchObject({
      excerpt: "A guide.",
      coverUrl: null,
      createdAt: "2026-02-01T10:00:00+00:00",
    });
  });
});
