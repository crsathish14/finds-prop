import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { png } from "@/features/site-content/__tests__/sponsor-fixtures";
import type { Json } from "@/types/database.types";
import { adminClient, visitorClient } from "./support/clients";
import {
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the store below takes its client directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { blogStore } = await import("@/features/blog/service");
const { createPost, publishPost, restorePost, saveCover, savePost, trashPost, unpublishPost } =
  await import("@/features/blog/post-service");
const { readBlogList } = await import("@/features/blog/queries");
const { BLOG_IMAGE_BUCKET } = await import("@/features/blog/constants");
const { ActionError } = await import("@/server/actions/normalise-error");

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

const RUN = Date.now().toString(36);
const TITLE = `Integration guide ${RUN}`;

describe("IT-blog: the Blog's admin and the visitor's search against a real database and bucket (ADR-143)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let customer: TestUser;
  let postId = "";
  let slug = "";
  const uploaded: string[] = [];

  const body = (words: string): { type: "paragraph"; text: string }[] => [
    { type: "paragraph", text: words },
  ];

  const editor = () => ({
    postId,
    title: TITLE,
    slug,
    excerpt: "A guide written by the integration test.",
    body: body(`Registration charges for ${RUN} are explained here.`),
    categoryId: null,
    tags: ["integration"],
    authorName: "Test Author",
    seoTitle: null,
    seoDescription: null,
  });

  const put = async (path: string, bytes: Uint8Array) => {
    const { error } = await staff.client.storage
      .from(BLOG_IMAGE_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Could not upload the test picture (${error.message})`);
    uploaded.push(path);
  };

  const exists = async (path: string) => {
    const { data } = await admin.storage.from(BLOG_IMAGE_BUCKET).download(path);
    return data !== null;
  };

  const found = async (words: string) => {
    const list = await readBlogList(visitorClient(), { query: words, page: 1 });
    return list.items.some((card) => card.slug === slug);
  };

  beforeAll(async () => {
    staff = await signInTestAdmin();
    customer = await signInTestCustomer();
  });

  afterAll(async () => {
    if (postId) await admin.from("blog_posts").delete().eq("id", postId);
    if (uploaded.length > 0) await admin.storage.from(BLOG_IMAGE_BUCKET).remove(uploaded);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("only the super admin makes an article: a customer and a visitor are refused", async () => {
    for (const client of [customer.client, visitorClient()]) {
      const refused = await failureOf(() =>
        createPost(blogStore(client), { title: TITLE, authorName: "Nobody", categoryId: null }),
      );
      expect(refused.code).toBe("FORBIDDEN");
    }
  });

  it("makes a draft whose address comes from the title, and a second one gets a number", async () => {
    const done = await createPost(blogStore(staff.client), {
      title: TITLE,
      authorName: "Test Author",
      categoryId: null,
    });
    postId = done.postId;
    slug = done.slug;
    expect(slug).toMatch(/^integration-guide-/);
    const second = await createPost(blogStore(staff.client), {
      title: TITLE,
      authorName: "Test Author",
      categoryId: null,
    });
    expect(second.slug).toBe(`${slug}-2`);
    await admin.from("blog_posts").delete().eq("id", second.postId);
  });

  it("keeps a draft from every visitor, found by address or by words", async () => {
    await savePost(blogStore(staff.client), editor());
    expect(await found(RUN)).toBe(false);
    const { data } = await visitorClient().from("blog_posts").select("id").eq("id", postId);
    expect(data).toEqual([]);
  });

  it("publishes, and the visitor's search then finds it by a word in the body, with the matched word marked", async () => {
    const done = await publishPost(blogStore(staff.client), { postId });
    expect(done.status).toBe("published");
    expect(await found(RUN)).toBe(true);
    const list = await readBlogList(visitorClient(), { query: "registration", page: 1 });
    const card = list.items.find((item) => item.slug === slug);
    expect(card?.snippet).toContain("[[Registration]]");
    const { data } = await admin
      .from("blog_posts")
      .select("published_at, read_minutes")
      .eq("id", postId)
      .single();
    expect(data?.published_at).not.toBeNull();
    expect(data?.read_minutes).toBe(1);
  });

  it("Trash unpublishes an article and hides it at once, and restoring never publishes it again", async () => {
    const trashed = await trashPost(blogStore(staff.client), { postId });
    expect(trashed.status).toBe("draft");
    expect(await found(RUN)).toBe(false);
    const restored = await restorePost(blogStore(staff.client), { postId });
    expect(restored.status).toBe("draft");
    expect(await found(RUN)).toBe(false);
    await publishPost(blogStore(staff.client), { postId });
    expect(await found(RUN)).toBe(true);
    await unpublishPost(blogStore(staff.client), { postId });
    expect(await found(RUN)).toBe(false);
    await publishPost(blogStore(staff.client), { postId });
  });

  it("measures a stored picture itself: a cover in the article's folder is accepted, one from another folder is not", async () => {
    const cover = `blog/${postId}/cover-${RUN}.png`;
    await put(cover, png(1600, 900, 40_000));
    const done = await saveCover(blogStore(staff.client), {
      postId,
      coverPath: cover,
      coverAlt: "A bright flat",
    });
    expect(done.slug).toBe(slug);
    const { data } = await visitorClient()
      .from("blog_posts")
      .select("cover_path, cover_alt")
      .eq("id", postId)
      .single();
    expect(data).toEqual({ cover_path: cover, cover_alt: "A bright flat" });

    const foreign = `blog/00000000-0000-4000-b500-000000000001/cover.png`;
    const refused = await failureOf(() =>
      saveCover(blogStore(staff.client), { postId, coverPath: foreign, coverAlt: "A flat" }),
    );
    expect(refused.fieldErrors?.coverPath?.[0]?.key).toBe("validation.blogImagePlace");
  });

  it("takes a replaced cover out of the bucket, and a missing picture is refused", async () => {
    const first = `blog/${postId}/cover-${RUN}.png`;
    const second = `blog/${postId}/cover-${RUN}-b.png`;
    await put(second, png(1600, 900, 40_000));
    await saveCover(blogStore(staff.client), { postId, coverPath: second, coverAlt: "Another" });
    expect(await exists(first)).toBe(false);
    expect(await exists(second)).toBe(true);

    const missing = await failureOf(() =>
      saveCover(blogStore(staff.client), {
        postId,
        coverPath: `blog/${postId}/never-uploaded.png`,
        coverAlt: "Nothing",
      }),
    );
    expect(missing.fieldErrors?.coverPath?.[0]?.key).toBe("validation.blogImageMissing");
  });

  it("the table itself refuses a body the checks do not allow, whatever the application did before", async () => {
    const { error } = await staff.client
      .from("blog_posts")
      .update({ body: [{ type: "html", text: "<b>x</b>" }] as unknown as NonNullable<Json> })
      .eq("id", postId);
    expect(error?.code).toBe("23514");
  });

  it("no client deletes an article, not even the admin", async () => {
    const { data, error } = await staff.client
      .from("blog_posts")
      .delete()
      .eq("id", postId)
      .select("id");
    expect(error?.code ?? "no rows").toMatch(/42501|no rows/);
    expect(data ?? []).toEqual([]);
    const { data: still } = await admin.from("blog_posts").select("id").eq("id", postId);
    expect(still).toHaveLength(1);
  });
});
