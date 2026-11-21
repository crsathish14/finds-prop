import type { BlogBlock } from "@/components/domain/blog-blocks";
import type { BlogPostFormValues } from "@/components/domain/blog-post-form";
import type { ActionFailure, ActionResult } from "@/types/action";
import { isPendingPath, randomToken } from "./blog-pictures";
import type { BlogStorage } from "./blog-storage";
import { blogImageFolder } from "./constants";
import type { PostDone } from "./post-service";

/**
 * Saving the Blog editor as one flow (ADR-143, ADR-144), apart from the screen so it can be tested with stand-ins.
 *
 * A new article is made first (a draft with the title, author and category), because a picture's folder is named after
 * the article's id. Pictures the admin chose wait in the browser until now: each is sent to the bucket under
 * `blog/<id>/`, the body is saved with their final paths, and then the cover (its own action) is set. If a later step
 * fails, the files sent for it are taken away again, so a refused save leaves nothing behind. The server decides on
 * every picture and on every word; nothing here is believed by it.
 */

/** A picture chosen in this visit and not sent yet. */
export type PendingPicture = { file: File; url: string; extension: string };
export type PendingPictures = Readonly<Record<string, PendingPicture>>;

export type BlogEditorActions = {
  create: (input: {
    title: string;
    authorName: string;
    slug?: string;
    categoryId: string | null;
  }) => Promise<ActionResult<PostDone>>;
  update: (input: {
    postId: string;
    title: string;
    slug: string;
    excerpt: string;
    body: BlogBlock[];
    categoryId: string | null;
    tags: string[];
    authorName: string;
    seoTitle: string | null;
    seoDescription: string | null;
  }) => Promise<ActionResult<PostDone>>;
  setCover: (input: {
    postId: string;
    coverPath: string | null;
    coverAlt: string | null;
  }) => Promise<ActionResult<PostDone>>;
};

export type SaveInput = {
  /** The article's id, or null for one that is not made yet. */
  postId: string | null;
  values: BlogPostFormValues;
  /** The cover now: a stored path, a waiting picture's name, or null. */
  coverPath: string | null;
  /** What is stored, so the cover action runs only when the cover changed. */
  stored: { coverPath: string | null; coverAlt: string | null };
  pending: PendingPictures;
  storage: BlogStorage;
  actions: BlogEditorActions;
  token?: () => string;
};

export type SaveStep = "check" | "create" | "upload" | "update" | "cover";

export type SaveResult =
  | { ok: true; postId: string; slug: string; created: boolean }
  | {
      ok: false;
      step: SaveStep;
      /** The article's id when it exists now (made by this save or before it), so the next save updates it. */
      postId: string | null;
      /** The address the article was made with. */
      slug: string | null;
      /** What an action said went wrong (not set when a picture could not be sent, or for the check). */
      failure?: ActionFailure;
      fieldErrors?: ActionFailure["fieldErrors"];
    };

/** The waiting pictures this article still uses: its image blocks and its cover. */
function pendingUsed(blocks: readonly BlogBlock[], coverPath: string | null): string[] {
  const used = new Set<string>();
  for (const block of blocks)
    if (block.type === "image" && isPendingPath(block.path)) used.add(block.path);
  if (coverPath && isPendingPath(coverPath)) used.add(coverPath);
  return [...used];
}

export async function saveArticle(input: SaveInput): Promise<SaveResult> {
  const { values, pending, storage, actions } = input;
  const token = input.token ?? randomToken;

  // A cover needs its description; say so before anything is made or sent.
  if (input.coverPath !== null && values.coverAlt.trim() === "") {
    return {
      ok: false,
      step: "check",
      postId: input.postId,
      slug: null,
      fieldErrors: { coverAlt: [{ key: "validation.required" }] },
    };
  }

  let postId = input.postId;
  let slug = values.slug.trim();
  let created = false;
  if (postId === null) {
    const made = await actions.create({
      title: values.title,
      authorName: values.authorName,
      ...(slug === "" ? {} : { slug }),
      categoryId: values.categoryId === "" ? null : values.categoryId,
    });
    if (!made.ok) return { ok: false, step: "create", postId: null, slug: null, failure: made };
    postId = made.data.postId;
    slug = slug === "" ? made.data.slug : slug;
    created = true;
  }

  const uploaded: string[] = [];
  const finalOf = new Map<string, string>();
  for (const waiting of pendingUsed(values.blocks, input.coverPath)) {
    const picture = pending[waiting];
    if (!picture) continue;
    const target = `${blogImageFolder(postId)}${token()}.${picture.extension}`;
    if (!(await storage.upload(target, picture.file))) {
      await storage.remove(uploaded);
      return { ok: false, step: "upload", postId, slug };
    }
    uploaded.push(target);
    finalOf.set(waiting, target);
  }

  const body = values.blocks.map((block) =>
    block.type === "image" && finalOf.has(block.path)
      ? { ...block, path: finalOf.get(block.path) as string }
      : block,
  );
  const saved = await actions.update({
    postId,
    title: values.title,
    slug,
    excerpt: values.excerpt,
    body,
    categoryId: values.categoryId === "" ? null : values.categoryId,
    tags: values.tags,
    authorName: values.authorName,
    seoTitle: values.seoTitle.trim() === "" ? null : values.seoTitle,
    seoDescription: values.seoDescription.trim() === "" ? null : values.seoDescription,
  });
  if (!saved.ok) {
    await storage.remove(uploaded);
    return { ok: false, step: "update", postId, slug, failure: saved };
  }

  const coverPath =
    input.coverPath === null ? null : (finalOf.get(input.coverPath) ?? input.coverPath);
  const coverAlt = coverPath === null ? null : values.coverAlt.trim();
  const changed =
    coverPath !== input.stored.coverPath ||
    (coverPath !== null && coverAlt !== (input.stored.coverAlt ?? ""));
  if (changed) {
    const set = await actions.setCover({ postId, coverPath, coverAlt });
    if (!set.ok) {
      await storage.remove(uploaded.filter((path) => path === coverPath));
      return { ok: false, step: "cover", postId, slug: saved.data.slug, failure: set };
    }
  }
  return { ok: true, postId, slug: saved.data.slug, created };
}
