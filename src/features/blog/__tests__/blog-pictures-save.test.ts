import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogBlock } from "@/components/domain/blog-blocks";
import type { BlogPostFormValues } from "@/components/domain/blog-post-form";
import {
  extensionOf,
  isPendingPath,
  newPendingPath,
  pictureProblem,
  randomToken,
} from "../blog-pictures";
import { saveArticle, type BlogEditorActions, type SaveInput } from "../blog-save";
import type { BlogStorage } from "../blog-storage";
import { BLOG_IMAGE_MAX_BYTES, BLOG_IMAGE_PATH } from "../constants";

describe("UT-blog-pictures: choosing a picture in the browser (ADR-144)", () => {
  it("takes JPG, PNG and WEBP by the kind the file says, and nothing else (no SVG)", () => {
    expect(extensionOf({ type: "image/png" })).toBe("png");
    expect(extensionOf({ type: "image/jpeg" })).toBe("jpg");
    expect(extensionOf({ type: "image/webp" })).toBe("webp");
    for (const type of ["image/svg+xml", "image/gif", "application/pdf", ""]) {
      expect(extensionOf({ type })).toBeNull();
      expect(pictureProblem({ type, size: 10 })).toBe("type");
    }
  });

  it("refuses a file heavier than the bucket's cap, and accepts one at the cap", () => {
    expect(pictureProblem({ type: "image/png", size: BLOG_IMAGE_MAX_BYTES })).toBeNull();
    expect(pictureProblem({ type: "image/png", size: BLOG_IMAGE_MAX_BYTES + 1 })).toBe("size");
  });

  it("names a waiting picture so it cannot be taken for a stored one, and makes names that fit the path rule", () => {
    const waiting = newPendingPath("abc123", "jpg");
    expect(waiting).toBe("pending/abc123.jpg");
    expect(isPendingPath(waiting)).toBe(true);
    expect(isPendingPath("blog/00000000-0000-4000-b500-0000000000a1/abc123.jpg")).toBe(false);
    const stored = `blog/00000000-0000-4000-b500-0000000000a1/${randomToken()}.webp`;
    expect(stored).toMatch(BLOG_IMAGE_PATH);
    expect(randomToken()).not.toBe(randomToken());
  });
});

const POST_ID = "00000000-0000-4000-b500-0000000000a1";
const FOLDER = `blog/${POST_ID}/`;

const VALUES: BlogPostFormValues = {
  title: "Stamp duty",
  slug: "stamp-duty",
  authorName: "Asha Rao",
  categoryId: "",
  tags: ["loans"],
  excerpt: "A summary.",
  seoTitle: "",
  seoDescription: "  ",
  blocks: [{ type: "paragraph", text: "Words." }],
  coverAlt: "",
};

const FILE = (name: string) => new File(["x"], name, { type: "image/png" });
const waiting = (path: string) => ({
  [path]: { file: FILE(path), url: `blob:${path}`, extension: "png" },
});

function setup(extra: Partial<SaveInput> = {}, failures: { upload?: boolean } = {}) {
  let counter = 0;
  const calls: string[] = [];
  const uploaded: string[] = [];
  const removed: string[] = [];
  const storage: BlogStorage = {
    upload: vi.fn(async (path: string) => {
      calls.push(`upload ${path}`);
      if (failures.upload) return false;
      uploaded.push(path);
      return true;
    }),
    remove: vi.fn(async (paths: readonly string[]) => {
      calls.push(`remove ${paths.join(",")}`);
      removed.push(...paths);
    }),
  };
  const done = (slug = "stamp-duty") => ({
    ok: true as const,
    data: { postId: POST_ID, slug, status: "draft" as const, slugs: [slug] },
  });
  const actions: BlogEditorActions = {
    create: vi.fn(async () => {
      calls.push("create");
      return done("stamp-duty-2");
    }),
    update: vi.fn(async () => {
      calls.push("update");
      return done();
    }),
    setCover: vi.fn(async () => {
      calls.push("cover");
      return done();
    }),
  };
  const input: SaveInput = {
    postId: POST_ID,
    values: VALUES,
    coverPath: null,
    stored: { coverPath: null, coverAlt: null },
    pending: {},
    storage,
    actions,
    token: () => `t${++counter}`,
    ...extra,
  };
  return { input, actions, storage, calls, uploaded, removed };
}

describe("UT-blog-save: saving the editor as one flow (ADR-143, ADR-144)", () => {
  let imageBlock: BlogBlock;
  beforeEach(() => {
    imageBlock = { type: "image", path: "pending/one.png", alt: "A flat" };
  });

  it("updates an existing article without making one, and sends tidy text boxes (empty means none)", async () => {
    const { input, actions, calls } = setup();
    const result = await saveArticle(input);
    expect(result).toEqual({ ok: true, postId: POST_ID, slug: "stamp-duty", created: false });
    expect(calls).toEqual(["update"]);
    expect(actions.update).toHaveBeenCalledWith({
      postId: POST_ID,
      title: "Stamp duty",
      slug: "stamp-duty",
      excerpt: "A summary.",
      body: VALUES.blocks,
      categoryId: null,
      tags: ["loans"],
      authorName: "Asha Rao",
      seoTitle: null,
      seoDescription: null,
    });
  });

  it("makes a new article first (a draft with the title, author and category), then saves the rest on its id", async () => {
    const { input, actions, calls } = setup({
      postId: null,
      values: { ...VALUES, slug: "", categoryId: "cat-1" },
    });
    const result = await saveArticle(input);
    expect(calls).toEqual(["create", "update"]);
    expect(actions.create).toHaveBeenCalledWith({
      title: "Stamp duty",
      authorName: "Asha Rao",
      categoryId: "cat-1",
    });
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({ postId: POST_ID, slug: "stamp-duty-2", categoryId: "cat-1" }),
    );
    expect(result).toMatchObject({ ok: true, postId: POST_ID, created: true });
  });

  it("sends the address the admin typed to the create action", async () => {
    const { input, actions } = setup({ postId: null, values: { ...VALUES, slug: " my-address " } });
    await saveArticle(input);
    expect(actions.create).toHaveBeenCalledWith(expect.objectContaining({ slug: "my-address" }));
  });

  it("stops at a refused create and sends nothing else, uploads included", async () => {
    const { input, actions, storage } = setup({
      postId: null,
      pending: waiting("pending/one.png"),
    });
    vi.mocked(actions.create).mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { title: [{ key: "validation.required" }] },
    });
    const result = await saveArticle({
      ...input,
      values: { ...VALUES, blocks: [imageBlock] },
    });
    expect(result).toMatchObject({ ok: false, step: "create", postId: null });
    expect(actions.update).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("sends each waiting picture to the article's own folder before the save, and writes the final paths into the body", async () => {
    const { input, actions, calls, uploaded } = setup({ pending: waiting("pending/one.png") });
    const result = await saveArticle({ ...input, values: { ...VALUES, blocks: [imageBlock] } });
    expect(result.ok).toBe(true);
    expect(uploaded).toEqual([`${FOLDER}t1.png`]);
    expect(uploaded[0]).toMatch(BLOG_IMAGE_PATH);
    expect(calls).toEqual([`upload ${FOLDER}t1.png`, "update"]);
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [{ type: "image", path: `${FOLDER}t1.png`, alt: "A flat" }],
      }),
    );
  });

  it("does not send a picture the body no longer uses, and keeps a stored one as it is", async () => {
    const stored: BlogBlock = { type: "image", path: `${FOLDER}old.png`, alt: "Old" };
    const { input, storage, actions } = setup({ pending: waiting("pending/unused.png") });
    await saveArticle({ ...input, values: { ...VALUES, blocks: [stored] } });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(actions.update).toHaveBeenCalledWith(expect.objectContaining({ body: [stored] }));
  });

  it("takes back what it sent when a later upload fails, and does not save", async () => {
    const { input, storage, actions } = setup({
      pending: { ...waiting("pending/one.png"), ...waiting("pending/two.png") },
    });
    vi.mocked(storage.upload).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await saveArticle({
      ...input,
      values: {
        ...VALUES,
        blocks: [imageBlock, { type: "image", path: "pending/two.png", alt: "Two" }],
      },
    });
    expect(result).toMatchObject({ ok: false, step: "upload" });
    expect(storage.remove).toHaveBeenCalledWith([`${FOLDER}t1.png`]);
    expect(actions.update).not.toHaveBeenCalled();
  });

  it("takes back the pictures it sent when the server refuses the save, and reports what it said", async () => {
    const { input, actions, storage } = setup({ pending: waiting("pending/one.png") });
    vi.mocked(actions.update).mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { "body.0.alt": [{ key: "validation.required" }] },
    });
    const result = await saveArticle({ ...input, values: { ...VALUES, blocks: [imageBlock] } });
    expect(result).toMatchObject({
      ok: false,
      step: "update",
      failure: { fieldErrors: { "body.0.alt": [{ key: "validation.required" }] } },
    });
    expect(storage.remove).toHaveBeenCalledWith([`${FOLDER}t1.png`]);
    expect(actions.setCover).not.toHaveBeenCalled();
  });

  it("keeps the article id when a new article was made and a later step failed, so the next save updates it", async () => {
    const { input, actions } = setup({ postId: null });
    vi.mocked(actions.update).mockResolvedValue({ ok: false, code: "INTERNAL" });
    const result = await saveArticle(input);
    expect(result).toMatchObject({
      ok: false,
      step: "update",
      postId: POST_ID,
      slug: "stamp-duty",
    });
  });

  it("sets a new cover after the body, from the final path, with its description", async () => {
    const { input, actions, calls } = setup({
      coverPath: "pending/cover.png",
      pending: waiting("pending/cover.png"),
      values: { ...VALUES, coverAlt: " A house " },
    });
    const result = await saveArticle(input);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([`upload ${FOLDER}t1.png`, "update", "cover"]);
    expect(actions.setCover).toHaveBeenCalledWith({
      postId: POST_ID,
      coverPath: `${FOLDER}t1.png`,
      coverAlt: "A house",
    });
  });

  it("does not touch the cover when it has not changed, and sets it again when only its description did", async () => {
    const cover = `${FOLDER}cover.png`;
    const same = setup({
      coverPath: cover,
      stored: { coverPath: cover, coverAlt: "A house" },
      values: { ...VALUES, coverAlt: "A house" },
    });
    await saveArticle(same.input);
    expect(same.actions.setCover).not.toHaveBeenCalled();
    const described = setup({
      coverPath: cover,
      stored: { coverPath: cover, coverAlt: "A house" },
      values: { ...VALUES, coverAlt: "A bigger house" },
    });
    await saveArticle(described.input);
    expect(described.actions.setCover).toHaveBeenCalledWith({
      postId: POST_ID,
      coverPath: cover,
      coverAlt: "A bigger house",
    });
  });

  it("removes the cover, with no description, when the admin took it away", async () => {
    const { input, actions } = setup({
      coverPath: null,
      stored: { coverPath: `${FOLDER}cover.png`, coverAlt: "A house" },
    });
    await saveArticle(input);
    expect(actions.setCover).toHaveBeenCalledWith({
      postId: POST_ID,
      coverPath: null,
      coverAlt: null,
    });
  });

  it("asks for the cover's description before anything is made or sent", async () => {
    const { input, calls } = setup({
      postId: null,
      coverPath: "pending/cover.png",
      pending: waiting("pending/cover.png"),
    });
    const result = await saveArticle(input);
    expect(result).toMatchObject({
      ok: false,
      step: "check",
      fieldErrors: { coverAlt: [{ key: "validation.required" }] },
    });
    expect(calls).toEqual([]);
  });

  it("takes back the new cover file when setting the cover fails, but keeps the body's pictures that were saved", async () => {
    const { input, actions, storage } = setup({
      coverPath: "pending/cover.png",
      pending: { ...waiting("pending/cover.png"), ...waiting("pending/one.png") },
      values: { ...VALUES, coverAlt: "A house", blocks: [imageBlock] },
    });
    vi.mocked(actions.setCover).mockResolvedValue({ ok: false, code: "INTERNAL" });
    const result = await saveArticle(input);
    expect(result).toMatchObject({ ok: false, step: "cover" });
    // One picture in the body (t1) and the cover (t2): only the cover file is taken back.
    expect(storage.remove).toHaveBeenLastCalledWith([`${FOLDER}t2.png`]);
  });
});
