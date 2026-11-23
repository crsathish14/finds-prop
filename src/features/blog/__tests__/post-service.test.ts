import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import type { Json } from "@/types/database.types";
import {
  archivePost,
  createPost,
  mapBlogError,
  publishPost,
  restorePost,
  saveCover,
  savePost,
  trashPost,
  unpublishPost,
  type BlogStore,
  type NewPostRow,
  type PostPatch,
  type StoredPost,
} from "../post-service";
import type { Block, UpdateBlogPostInput } from "../schemas";

const POST = "00000000-0000-4000-b500-0000000000a1";
const OTHER = "00000000-0000-4000-b500-0000000000a2";
const COVER = `blog/${POST}/cover-1.webp`;
const PICTURE = `blog/${POST}/living-room.png`;
const FOREIGN = `blog/${OTHER}/living-room.png`;

/** The first bytes of a PNG of the given pixel size, padded to `total` bytes. */
function png(width: number, height: number, total = 200): Uint8Array {
  const bytes = new Uint8Array(total);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const paragraph: Block = { type: "paragraph", text: "Some words." };
const picture = (path: string): Block => ({ type: "image", path, alt: "A room" });

function stored(overrides: Partial<StoredPost> = {}): StoredPost {
  return {
    id: POST,
    slug: "guide",
    title: "Guide",
    excerpt: "A guide.",
    body: [paragraph] as unknown as Json,
    status: "draft",
    deletedAt: null,
    coverPath: null,
    coverAlt: null,
    ...overrides,
  };
}

function harness(
  options: {
    post?: StoredPost | null;
    files?: Record<string, Uint8Array>;
    takenSlugs?: string[];
    removeFails?: boolean;
  } = {},
) {
  const calls: {
    inserted: NewPostRow[];
    patches: PostPatch[];
    fetched: string[];
    removed: string[];
  } = { inserted: [], patches: [], fetched: [], removed: [] };
  const post = options.post === undefined ? stored() : options.post;
  const taken = new Set(options.takenSlugs ?? []);
  const store: BlogStore = {
    insert(row) {
      calls.inserted.push(row);
      if (taken.has(row.slug)) {
        return Promise.reject(mapBlogError({ code: "23505" }));
      }
      return Promise.resolve({ postId: POST, slug: row.slug });
    },
    read: () => Promise.resolve(post),
    update(_postId, patch) {
      calls.patches.push(patch);
      return Promise.resolve();
    },
    fetchImage(path) {
      calls.fetched.push(path);
      return Promise.resolve(options.files?.[path] ?? null);
    },
    removeFiles(paths) {
      calls.removed.push(...paths);
      return options.removeFails ? Promise.reject(new Error("down")) : Promise.resolve();
    },
  };
  return { store, calls };
}

const logger = () => ({ warn: vi.fn() });

function editor(overrides: Partial<UpdateBlogPostInput> = {}): UpdateBlogPostInput {
  return {
    postId: POST,
    title: "Guide to buying",
    slug: "guide",
    excerpt: "A guide.",
    body: [paragraph],
    categoryId: null,
    tags: ["chennai"],
    authorName: "Asha Rao",
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
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

describe("UT-blog-service: making an article", () => {
  const input = { title: "Guide to buying a flat", authorName: "Asha Rao", categoryId: null };

  it("makes a draft whose address comes from the title", async () => {
    const { store, calls } = harness();
    const done = await createPost(store, input);
    expect(calls.inserted).toEqual([
      {
        slug: "guide-to-buying-a-flat",
        title: "Guide to buying a flat",
        author_name: "Asha Rao",
        category_id: null,
      },
    ]);
    expect(done).toMatchObject({
      postId: POST,
      status: "draft",
      slugs: ["guide-to-buying-a-flat"],
    });
  });

  it("numbers a made address that is taken, and finally adds a short tail", async () => {
    const first = harness({ takenSlugs: ["guide-to-buying-a-flat", "guide-to-buying-a-flat-2"] });
    expect((await createPost(first.store, input)).slug).toBe("guide-to-buying-a-flat-3");

    const all = [
      "guide-to-buying-a-flat",
      ...[2, 3, 4, 5].map((number) => `guide-to-buying-a-flat-${number}`),
    ];
    const last = harness({ takenSlugs: all });
    expect((await createPost(last.store, input, () => "ab12")).slug).toBe(
      "guide-to-buying-a-flat-ab12",
    );
  });

  it("refuses a typed address that is taken, naming the box, and tries nothing else", async () => {
    const { store, calls } = harness({ takenSlugs: ["mine"] });
    const refused = await failure(createPost(store, { ...input, slug: "mine" }));
    expect(refused.fieldErrors).toEqual({ slug: [{ key: "validation.blogSlugTaken" }] });
    expect(calls.inserted).toHaveLength(1);
  });

  it("falls back to a plain word when the title has no letters or digits to make an address from", async () => {
    const { store, calls } = harness();
    await createPost(store, { ...input, title: "தமிழ் வலைப்பதிவு" });
    expect(calls.inserted[0]?.slug).toBe("article");
  });
});

describe("UT-blog-service: saving the editor", () => {
  it("saves the words and the blocks, and answers the old and the new address for the cache", async () => {
    const { store, calls } = harness();
    const done = await savePost(store, editor({ slug: "guide-renamed" }));
    expect(calls.patches).toEqual([
      {
        slug: "guide-renamed",
        title: "Guide to buying",
        excerpt: "A guide.",
        body: [paragraph],
        category_id: null,
        tags: ["chennai"],
        author_name: "Asha Rao",
        seo_title: null,
        seo_description: null,
      },
    ]);
    expect(done.slugs.sort()).toEqual(["guide", "guide-renamed"]);
    expect(Object.keys(calls.patches[0] ?? {})).not.toContain("status");
    expect(Object.keys(calls.patches[0] ?? {})).not.toContain("cover_path");
  });

  it("answers not found for an article that is not there, and for one in Trash", async () => {
    expect((await failure(savePost(harness({ post: null }).store, editor()))).code).toBe(
      "NOT_FOUND",
    );
    const trashed = harness({ post: stored({ deletedAt: "2026-03-01T00:00:00Z" }) });
    expect((await failure(savePost(trashed.store, editor()))).code).toBe("NOT_FOUND");
    expect(trashed.calls.patches).toEqual([]);
  });

  it("reads a new picture back from the bucket and accepts a good one", async () => {
    const { store, calls } = harness({ files: { [PICTURE]: png(1200, 800) } });
    await savePost(store, editor({ body: [paragraph, picture(PICTURE)] }));
    expect(calls.fetched).toEqual([PICTURE]);
    expect(calls.patches).toHaveLength(1);
  });

  it("does not read a picture the article already used", async () => {
    const used = harness({ post: stored({ body: [picture(PICTURE)] as unknown as Json }) });
    await savePost(used.store, editor({ body: [picture(PICTURE), paragraph] }));
    expect(used.calls.fetched).toEqual([]);
  });

  it("refuses a picture that is missing, not a picture, too heavy or too large, naming the body", async () => {
    const missing = await failure(savePost(harness().store, editor({ body: [picture(PICTURE)] })));
    expect(missing.fieldErrors).toEqual({ body: [{ key: "validation.blogImageMissing" }] });

    const text = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const notPicture = await failure(
      savePost(harness({ files: { [PICTURE]: text } }).store, editor({ body: [picture(PICTURE)] })),
    );
    expect(notPicture.fieldErrors).toEqual({ body: [{ key: "validation.blogImageType" }] });

    const heavy = await failure(
      savePost(
        harness({ files: { [PICTURE]: png(1200, 800, 600 * 1024) } }).store,
        editor({ body: [picture(PICTURE)] }),
      ),
    );
    expect(heavy.fieldErrors).toEqual({
      body: [{ key: "validation.blogImageSize", values: { maximum: 500 } }],
    });

    const huge = await failure(
      savePost(
        harness({ files: { [PICTURE]: png(7000, 800) } }).store,
        editor({ body: [picture(PICTURE)] }),
      ),
    );
    expect(huge.fieldErrors).toEqual({
      body: [{ key: "validation.blogImageTooLarge", values: { maximum: 6000 } }],
    });
  });

  it("refuses another article's picture before reading anything or writing", async () => {
    const { store, calls } = harness({ files: { [FOREIGN]: png(1200, 800) } });
    const refused = await failure(savePost(store, editor({ body: [picture(FOREIGN)] })));
    expect(refused.fieldErrors).toEqual({ body: [{ key: "validation.blogImagePlace" }] });
    expect(calls.fetched).toEqual([]);
    expect(calls.patches).toEqual([]);
  });

  it("writes nothing when a picture fails", async () => {
    const { store, calls } = harness();
    await failure(savePost(store, editor({ body: [picture(PICTURE)] })));
    expect(calls.patches).toEqual([]);
    expect(calls.removed).toEqual([]);
  });

  it("takes out the pictures nothing uses any more, never the cover, and a failure only warns", async () => {
    const before = stored({
      body: [picture(PICTURE)] as unknown as Json,
      coverPath: COVER,
      coverAlt: "A cover",
    });
    const { store, calls } = harness({ post: before });
    await savePost(store, editor({ body: [paragraph] }));
    expect(calls.removed).toEqual([PICTURE]);

    const failing = harness({ post: before, removeFails: true });
    const log = logger();
    await savePost(failing.store, editor({ body: [paragraph] }), log);
    expect(log.warn).toHaveBeenCalledWith("blog pictures could not be removed", { count: 1 });
  });
});

describe("UT-blog-service: the cover", () => {
  it("sets a cover read back from the bucket, with its description, and removes the one it replaces", async () => {
    const before = stored({ coverPath: `blog/${POST}/old-cover.png`, coverAlt: "Old" });
    const { store, calls } = harness({ post: before, files: { [COVER]: png(1600, 900) } });
    await saveCover(store, { postId: POST, coverPath: COVER, coverAlt: "A bright flat" });
    expect(calls.fetched).toEqual([COVER]);
    expect(calls.patches).toEqual([{ cover_path: COVER, cover_alt: "A bright flat" }]);
    expect(calls.removed).toEqual([`blog/${POST}/old-cover.png`]);
  });

  it("removes the cover, and keeps a file the body still uses", async () => {
    const before = stored({
      body: [picture(COVER)] as unknown as Json,
      coverPath: COVER,
      coverAlt: "A",
    });
    const { store, calls } = harness({ post: before });
    await saveCover(store, { postId: POST, coverPath: null, coverAlt: null });
    expect(calls.patches).toEqual([{ cover_path: null, cover_alt: null }]);
    expect(calls.removed).toEqual([]);
  });

  it("refuses a cover from another article's folder or one that is not there", async () => {
    const foreign = await failure(
      saveCover(harness().store, { postId: POST, coverPath: FOREIGN, coverAlt: "x" }),
    );
    expect(foreign.fieldErrors).toEqual({ coverPath: [{ key: "validation.blogImagePlace" }] });
    const missing = await failure(
      saveCover(harness().store, { postId: POST, coverPath: COVER, coverAlt: "x" }),
    );
    expect(missing.fieldErrors).toEqual({ coverPath: [{ key: "validation.blogImageMissing" }] });
  });
});

describe("UT-blog-service: status and Trash", () => {
  it("publishes a complete article", async () => {
    const { store, calls } = harness();
    const done = await publishPost(store, { postId: POST });
    expect(calls.patches).toEqual([{ status: "published" }]);
    expect(done).toMatchObject({ status: "published", slugs: ["guide"] });
  });

  it("refuses to publish with no summary or no body, naming each", async () => {
    const empty = harness({ post: stored({ excerpt: " ", body: [] as unknown as Json }) });
    const refused = await failure(publishPost(empty.store, { postId: POST }));
    expect(refused.code).toBe("VALIDATION");
    expect(refused.fieldErrors).toEqual({
      excerpt: [{ key: "validation.blogNeedsExcerpt" }],
      body: [{ key: "validation.blogNeedsBody" }],
    });
    expect(empty.calls.patches).toEqual([]);
  });

  it("unpublishes to a draft and archives", async () => {
    const one = harness({ post: stored({ status: "published" }) });
    expect(await unpublishPost(one.store, { postId: POST })).toMatchObject({ status: "draft" });
    expect(one.calls.patches).toEqual([{ status: "draft" }]);
    const two = harness();
    expect(await archivePost(two.store, { postId: POST })).toMatchObject({ status: "archived" });
    expect(two.calls.patches).toEqual([{ status: "archived" }]);
  });

  it("moves a published article to Trash as a draft, and keeps an archived one archived", async () => {
    const now = () => new Date("2026-03-05T10:00:00.000Z");
    const published = harness({ post: stored({ status: "published" }) });
    expect(await trashPost(published.store, { postId: POST }, now)).toMatchObject({
      status: "draft",
    });
    expect(published.calls.patches).toEqual([
      { status: "draft", deleted_at: "2026-03-05T10:00:00.000Z" },
    ]);
    const archived = harness({ post: stored({ status: "archived" }) });
    await trashPost(archived.store, { postId: POST }, now);
    expect(archived.calls.patches).toEqual([
      { status: "archived", deleted_at: "2026-03-05T10:00:00.000Z" },
    ]);
  });

  it("trashing an article already in Trash writes nothing", async () => {
    const trashed = harness({ post: stored({ deletedAt: "2026-03-01T00:00:00Z" }) });
    await trashPost(trashed.store, { postId: POST });
    expect(trashed.calls.patches).toEqual([]);
  });

  it("restores from Trash without changing the status, and never publishes by itself", async () => {
    const trashed = harness({
      post: stored({ deletedAt: "2026-03-01T00:00:00Z", status: "draft" }),
    });
    expect(await restorePost(trashed.store, { postId: POST })).toMatchObject({ status: "draft" });
    expect(trashed.calls.patches).toEqual([{ deleted_at: null }]);
  });

  it("answers not found for an article that is not there, on every status change", async () => {
    const none = harness({ post: null });
    for (const change of [publishPost, unpublishPost, archivePost, trashPost, restorePost]) {
      expect((await failure(change(none.store, { postId: POST }))).code).toBe("NOT_FOUND");
    }
    const trashed = harness({ post: stored({ deletedAt: "2026-03-01T00:00:00Z" }) });
    expect((await failure(publishPost(trashed.store, { postId: POST }))).code).toBe("NOT_FOUND");
  });
});

describe("UT-blog-service: what the database says", () => {
  it.each([
    [{ code: "23505" }, "VALIDATION", "slug"],
    [
      { code: "23514", message: "an article belongs to a Blog category" },
      "VALIDATION",
      "categoryId",
    ],
    [{ code: "23503" }, "VALIDATION", "categoryId"],
    [{ code: "23514" }, "VALIDATION", "_form"],
    [{ code: "P0002" }, "NOT_FOUND", undefined],
    [{ code: "PGRST116" }, "NOT_FOUND", undefined],
    [{ code: "42501" }, "FORBIDDEN", undefined],
    [{ code: "XX000" }, "INTERNAL", undefined],
  ] as const)("maps %j to %s", (failureShape, code, field) => {
    const mapped = mapBlogError(failureShape);
    expect(mapped.code).toBe(code);
    if (field) expect(Object.keys(mapped.fieldErrors ?? {})).toEqual([field]);
  });
});
