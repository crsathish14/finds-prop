import { describe, expect, it, vi } from "vitest";
import { pngWithSize } from "../../../../../tests/image-files";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { createBlogPostFromMarkdownConfig } from "../../action-config";
import {
  createPostFromMarkdown,
  mapBlogError,
  type BlogStore,
  type NewPostRow,
  type PostPatch,
  type PostDone,
} from "../../post-service";
import { createBlogPostFromMarkdownSchema } from "../../schemas";

const POST = "00000000-0000-4000-b500-0000000000a1";
const CATEGORY = "00000000-0000-4000-b500-0000000000c1";

const admin: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000ad",
  roles: ["customer", "super_admin"],
  phoneVerified: false,
  builderId: null,
};
const customer: SessionView = { ...admin, roles: ["customer"], phoneVerified: true };
const builder: SessionView = {
  ...admin,
  roles: ["customer", "builder"],
  builderId: "00000000-0000-4000-8000-0000000000b1",
};

const ARTICLE = `# Plots in Chennai

A short intro with a [guide](https://example.com/guide).

## Steps

- one
- two
`;

const typed = {
  markdown: ARTICLE,
  title: "Plots in Chennai",
  excerpt: "A short intro.",
  authorName: "Asha Rao",
  categoryId: null,
};

function harness(options: { session?: SessionView | null } = {}) {
  const calls: string[] = [];
  const received: unknown[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? admin : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return Promise.resolve();
    },
    beginIdempotent: () => Promise.resolve({ replay: false as const }),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: () => {
      calls.push("audit");
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const done: PostDone = { postId: POST, slug: "plots", status: "draft", slugs: ["plots"] };
  return {
    calls,
    received,
    run: createDefineAction(deps)({
      ...createBlogPostFromMarkdownConfig,
      handler: ({ input }: { input: unknown }) => {
        calls.push("handler");
        received.push(input);
        return Promise.resolve(done);
      },
    }),
  };
}

/** A whole PNG of the given pixel size, padded to `total` bytes (the server also checks that it is whole and clean). */
const png = pngWithSize;

function storeOf(options: { takenSlugs?: string[]; files?: Record<string, Uint8Array> } = {}) {
  const inserted: NewPostRow[] = [];
  const patches: PostPatch[] = [];
  const taken = new Set(options.takenSlugs ?? []);
  let madeId = POST;
  const store: BlogStore = {
    insert(row) {
      inserted.push(row);
      madeId = row.id ?? POST;
      return taken.has(row.slug)
        ? Promise.reject(mapBlogError({ code: "23505" }))
        : Promise.resolve({ postId: madeId, slug: row.slug });
    },
    read: () =>
      Promise.resolve({
        id: madeId,
        slug: "plots-in-chennai",
        title: "Plots in Chennai",
        excerpt: "",
        body: [],
        status: "draft",
        deletedAt: null,
        coverPath: null,
        coverAlt: null,
      }),
    update(_postId, patch) {
      patches.push(patch);
      return Promise.resolve();
    },
    fetchImage: (path) => Promise.resolve(options.files?.[path] ?? null),
    removeFiles: () => Promise.resolve(),
  };
  return { store, inserted, patches };
}

async function failure(promise: Promise<unknown>): Promise<ActionError> {
  try {
    await promise;
  } catch (thrown) {
    if (thrown instanceof ActionError) return thrown;
    throw thrown;
  }
  throw new Error("expected a failure");
}

describe("UT-blog-markdown-action: who may paste Markdown (ADR-172)", () => {
  it("lets a super admin through: the admin_edit limit, the handler, the Blog's list and the article's page", async () => {
    const suite = harness();
    expect((await suite.run(typed)).ok).toBe(true);
    expect(suite.calls).toEqual([
      "rateLimit:admin_edit",
      "handler",
      "invalidate:blog|blog-post:plots",
    ]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs", async (_who, session, code) => {
    const suite = harness({ session });
    expect(await suite.run(typed)).toMatchObject({ ok: false, code });
    expect(suite.calls).toEqual([]);
  });

  it("refuses input that is not valid before the handler, naming the box", async () => {
    const suite = harness();
    expect(await suite.run({ ...typed, title: "A" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { title: expect.any(Array) },
    });
    expect(await suite.run({ ...typed, slug: "Not A Slug" })).toMatchObject({ ok: false });
    expect(await suite.run({ ...typed, authorName: "" })).toMatchObject({ ok: false });
    expect(suite.calls).toEqual([]);
  });

  it("refuses a text over the limit without reading it", () => {
    const parsed = createBlogPostFromMarkdownSchema.safeParse({
      ...typed,
      markdown: "a".repeat(400_001),
    });
    expect(parsed.success).toBe(false);
  });

  it("does not take blocks from the browser: an extra body key is dropped", () => {
    const parsed = createBlogPostFromMarkdownSchema.parse({
      ...typed,
      body: [{ type: "paragraph", text: "sneaky" }],
    });
    expect(parsed).not.toHaveProperty("body");
  });
});

describe("UT-blog-markdown-service: making the draft (ADR-172)", () => {
  const input = createBlogPostFromMarkdownSchema.parse(typed);

  it("converts the text itself and saves the blocks it made, with the typed title, summary and author", async () => {
    const { store, inserted, patches } = storeOf();
    const done = await createPostFromMarkdown(store, input);
    expect(inserted).toEqual([
      {
        slug: "plots-in-chennai",
        title: "Plots in Chennai",
        author_name: "Asha Rao",
        category_id: null,
      },
    ]);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      slug: "plots-in-chennai",
      title: "Plots in Chennai",
      excerpt: "A short intro.",
      category_id: null,
      tags: [],
      author_name: "Asha Rao",
      seo_title: null,
      seo_description: null,
      body: [
        { type: "paragraph", text: "A short intro with a [guide](https://example.com/guide)." },
        { type: "heading", level: 2, text: "Steps" },
        { type: "list", ordered: false, items: ["one", "two"] },
      ],
    });
    expect(done).toMatchObject({ postId: POST, slug: "plots-in-chennai", status: "draft" });
  });

  it("never stores the pasted text", async () => {
    const { store, inserted, patches } = storeOf();
    await createPostFromMarkdown(store, input);
    const everything = JSON.stringify([inserted, patches]);
    expect(everything).not.toContain("# Plots in Chennai");
    expect(everything).not.toContain("markdown");
  });

  it("uses the category and the typed address", async () => {
    const { store, inserted } = storeOf();
    await createPostFromMarkdown(
      store,
      createBlogPostFromMarkdownSchema.parse({
        ...typed,
        categoryId: CATEGORY,
        slug: "my-address",
      }),
    );
    expect(inserted[0]).toMatchObject({ slug: "my-address", category_id: CATEGORY });
  });

  it("makes nothing when the converter reports a problem, and names the markdown box", async () => {
    const { store, inserted, patches } = storeOf();
    const refused = await failure(
      createPostFromMarkdown(
        store,
        createBlogPostFromMarkdownSchema.parse({ ...typed, markdown: `## ${"w".repeat(170)}` }),
      ),
    );
    expect(refused.code).toBe("VALIDATION");
    expect(refused.fieldErrors?.["markdown"]).toEqual([{ key: "validation.blogMarkdownRefused" }]);
    expect(inserted).toEqual([]);
    expect(patches).toEqual([]);
  });

  it("makes nothing when there are too many blocks", async () => {
    const { store, inserted } = storeOf();
    const text = Array.from({ length: 101 }, (_, number) => `Paragraph ${number}`).join("\n\n");
    await failure(
      createPostFromMarkdown(
        store,
        createBlogPostFromMarkdownSchema.parse({ ...typed, markdown: text }),
      ),
    );
    expect(inserted).toEqual([]);
  });

  it("keeps a refused link as its words, so the saved body is always one the schema accepts", async () => {
    const { store, patches } = storeOf();
    await createPostFromMarkdown(
      store,
      createBlogPostFromMarkdownSchema.parse({
        ...typed,
        markdown: "See [here](javascript:void) and [there](http://example.com).",
      }),
    );
    expect(patches[0]?.body).toEqual([{ type: "paragraph", text: "See here and there." }]);
  });

  it("answers the address-taken problem when a typed address is used", async () => {
    const { store, patches } = storeOf({ takenSlugs: ["taken"] });
    const refused = await failure(
      createPostFromMarkdown(
        store,
        createBlogPostFromMarkdownSchema.parse({ ...typed, slug: "taken" }),
      ),
    );
    expect(refused.fieldErrors?.["slug"]).toEqual([{ key: "validation.blogSlugTaken" }]);
    expect(patches).toEqual([]);
  });

  it("passes the log through to the save", async () => {
    const { store } = storeOf();
    const log = { warn: vi.fn() };
    await createPostFromMarkdown(store, input, log);
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe("UT-blog-markdown-pictures: a draft with pictures (ADR-173)", () => {
  const NEW_ID = "00000000-0000-4000-b500-0000000000f1";
  const OTHER_ID = "00000000-0000-4000-b500-0000000000f2";
  const FILE = `blog/${NEW_ID}/aa11.png`;
  const text = `# Gate\n\nBefore.\n\n![The front gate](IMAGE-1)\n\nAfter.`;
  const withPicture = (overrides: Record<string, unknown> = {}) =>
    createBlogPostFromMarkdownSchema.parse({
      ...typed,
      markdown: text,
      postId: NEW_ID,
      pictures: [{ slot: "IMAGE-1", path: FILE, alt: "The gate at dusk" }],
      ...overrides,
    });

  it("makes the draft with the id the browser chose and the picture at its place", async () => {
    const { store, inserted, patches } = storeOf({ files: { [FILE]: png(1200, 800) } });
    await createPostFromMarkdown(store, withPicture());
    expect(inserted[0]).toMatchObject({ id: NEW_ID });
    expect(patches[0]?.body).toEqual([
      { type: "paragraph", text: "Before." },
      { type: "image", path: FILE, alt: "The gate at dusk" },
      { type: "paragraph", text: "After." },
    ]);
  });

  it("makes no draft with no id when there are no pictures", async () => {
    const { store, inserted } = storeOf();
    await createPostFromMarkdown(store, createBlogPostFromMarkdownSchema.parse(typed));
    expect(inserted[0]).not.toHaveProperty("id");
  });

  it("refuses a picture list without the article's id", () => {
    const parsed = createBlogPostFromMarkdownSchema.safeParse({
      ...typed,
      markdown: text,
      pictures: [{ slot: "IMAGE-1", path: FILE, alt: "x" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a picture whose file is not in the bucket, before any draft is made", async () => {
    const { store, inserted } = storeOf();
    const refused = await failure(createPostFromMarkdown(store, withPicture()));
    expect(refused.fieldErrors?.["pictures"]).toEqual([{ key: "validation.blogImageMissing" }]);
    expect(inserted).toEqual([]);
  });

  it("refuses a file that is too big or too wide, before any draft is made", async () => {
    const big = storeOf({ files: { [FILE]: png(1200, 800, 600 * 1024) } });
    expect((await failure(createPostFromMarkdown(big.store, withPicture()))).fieldErrors).toEqual({
      pictures: [{ key: "validation.blogImageSize", values: { maximum: 500 } }],
    });
    const wide = storeOf({ files: { [FILE]: png(7000, 800) } });
    await failure(createPostFromMarkdown(wide.store, withPicture()));
    expect(big.inserted).toEqual([]);
    expect(wide.inserted).toEqual([]);
  });

  it("refuses a file that is in another article's folder", async () => {
    const foreign = `blog/${OTHER_ID}/aa11.png`;
    const { store, inserted } = storeOf({ files: { [foreign]: png(1200, 800) } });
    const refused = await failure(
      createPostFromMarkdown(
        store,
        withPicture({ pictures: [{ slot: "IMAGE-1", path: foreign, alt: "x" }] }),
      ),
    );
    expect(refused.fieldErrors?.["pictures"]).toEqual([{ key: "validation.blogImagePlace" }]);
    expect(inserted).toEqual([]);
  });

  it("refuses a picture for a place the text does not have, or two for one place", async () => {
    const { store, inserted } = storeOf({ files: { [FILE]: png(1200, 800) } });
    const stray = await failure(
      createPostFromMarkdown(
        store,
        withPicture({ pictures: [{ slot: "IMAGE-9", path: FILE, alt: "x" }] }),
      ),
    );
    expect(stray.fieldErrors?.["markdown"]).toEqual([{ key: "validation.blogMarkdownRefused" }]);
    await failure(
      createPostFromMarkdown(
        store,
        withPicture({
          pictures: [
            { slot: "IMAGE-1", path: FILE, alt: "x" },
            { slot: "IMAGE-1", path: FILE, alt: "y" },
          ],
        }),
      ),
    );
    expect(inserted).toEqual([]);
  });

  it("refuses a picture with no description and a path that is not a picture path", () => {
    expect(
      createBlogPostFromMarkdownSchema.safeParse({
        ...typed,
        markdown: text,
        postId: NEW_ID,
        pictures: [{ slot: "IMAGE-1", path: FILE, alt: "  " }],
      }).success,
    ).toBe(false);
    expect(
      createBlogPostFromMarkdownSchema.safeParse({
        ...typed,
        markdown: text,
        postId: NEW_ID,
        pictures: [{ slot: "IMAGE-1", path: "https://example.com/x.png", alt: "x" }],
      }).success,
    ).toBe(false);
  });
});
