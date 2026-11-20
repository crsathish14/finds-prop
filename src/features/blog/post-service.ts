import { readImageInfo } from "@/features/site-content";
import { ActionError } from "@/server/actions/normalise-error";
import {
  BLOG_IMAGE_MAX_BYTES,
  BLOG_IMAGE_MAX_KB,
  BLOG_IMAGE_MAX_SIDE,
  blogImageFolder,
  type BlogStatus,
} from "./constants";
import { imagePathsOf } from "./body-text";
import type {
  BlogPostIdInput,
  CreateBlogPostInput,
  SetBlogCoverInput,
  UpdateBlogPostInput,
} from "./schemas";
import { slugFromTitle, slugWithSuffix, slugWithTail } from "./slug";
import { parseBody } from "./view";
import type { Json } from "@/types/database.types";

/**
 * The rules of the Blog's admin (ADR-143, ADR-144), apart from the code that reaches the database and the bucket, so
 * they can be tested with a stand-in. The real store is in `service.ts` and acts as the signed-in admin through their
 * own session: the table's policies let only the super admin write, so nothing here uses the service role. The action
 * has already checked the caller is the super admin and counted the rate limit.
 *
 * The browser puts a picture in the bucket first and sends its path. Nothing it says about a file is believed: each
 * new file is read back from the bucket here, and its type, weight and size are worked out from its own bytes. A file
 * must sit in this article's own folder (`blog/<id>/`), so one article cannot point at another's picture. The row is
 * written only when every new picture passes; files that nothing uses any more are taken out afterwards (a failure
 * there is logged, never raised: the row is already right and nothing points to them).
 */

/** What the store answers after a write: enough for the caller to refresh the cache and to open the article. */
export interface PostDone {
  postId: string;
  slug: string;
  status: BlogStatus;
  /** Every address this change touched (the old slug too, after a rename), for the cache tags. */
  slugs: string[];
}

/** An article as stored, for the rules that look before they write. */
export interface StoredPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: Json;
  status: string;
  deletedAt: string | null;
  coverPath: string | null;
  coverAlt: string | null;
}

/** The columns a write sets (the names are the table's). */
export interface PostPatch {
  slug?: string;
  title?: string;
  excerpt?: string;
  body?: NonNullable<Json>;
  category_id?: string | null;
  tags?: string[];
  author_name?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  cover_path?: string | null;
  cover_alt?: string | null;
  status?: BlogStatus;
  deleted_at?: string | null;
}

export interface NewPostRow {
  slug: string;
  title: string;
  author_name: string;
  category_id: string | null;
}

/** Calls made as the signed-in admin. Each throws the database's failure through `mapBlogError`. */
export interface BlogStore {
  insert(row: NewPostRow): Promise<{ postId: string; slug: string }>;
  /** The article, or `null` when there is none the admin can see. */
  read(postId: string): Promise<StoredPost | null>;
  update(postId: string, patch: PostPatch): Promise<void>;
  /** A file of the bucket, or `null` when there is none (or it cannot be read). */
  fetchImage(path: string): Promise<Uint8Array | null>;
  /** Takes files out of the bucket. */
  removeFiles(paths: readonly string[]): Promise<void>;
}

interface Logger {
  warn: (message: string, context?: Record<string, unknown>) => void;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A slug already used is a problem with the slug
 * box; a category that is not a Blog category is a problem with the category; a refusal by the policy is the admin gate;
 * anything else is ours and is not repeated.
 */
export function mapBlogError(failure: DatabaseFailure): ActionError {
  const { code } = failure;
  if (code === "23505") {
    return new ActionError("VALIDATION", "That slug is already used", {
      fieldErrors: { slug: [{ key: "validation.blogSlugTaken" }] },
    });
  }
  if (code === "23503" || (code === "23514" && /Blog category/.test(failure.message ?? ""))) {
    return new ActionError("VALIDATION", "The category is not a Blog category", {
      fieldErrors: { categoryId: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "23514") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "P0002" || code === "PGRST116") {
    return new ActionError("NOT_FOUND", "The article was not found");
  }
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The article could not be saved");
}

const NOT_FOUND = () => new ActionError("NOT_FOUND", "The article was not found");

function isStatus(value: string): value is BlogStatus {
  return value === "draft" || value === "published" || value === "archived";
}

/** How many numbered addresses are tried (`title`, `title-2` ... `title-5`) before a random tail is added. */
const SLUG_ATTEMPTS = 5;

function isSlugTaken(failure: unknown): boolean {
  return failure instanceof ActionError && failure.fieldErrors?.slug !== undefined;
}

/**
 * Makes a draft with an empty body. The address is the one typed, or made from the title: a made one that is taken
 * becomes `title-2`, `title-3` and so on (then gets a random tail), while a typed one that is taken is the admin's
 * to change, so it is refused.
 */
export async function createPost(
  store: BlogStore,
  input: CreateBlogPostInput,
  randomTail: () => string = () => crypto.randomUUID().slice(0, 4),
): Promise<PostDone> {
  const typed = input.slug !== undefined;
  const base = input.slug ?? (slugFromTitle(input.title) || "article");
  const candidates = typed
    ? [base]
    : Array.from({ length: SLUG_ATTEMPTS + 1 }, (_, index) =>
        index === 0
          ? base
          : index < SLUG_ATTEMPTS
            ? slugWithSuffix(base, index + 1)
            : slugWithTail(base, randomTail()),
      );
  let lastFailure: unknown;
  for (const slug of candidates) {
    try {
      const made = await store.insert({
        slug,
        title: input.title,
        author_name: input.authorName,
        category_id: input.categoryId,
      });
      return { postId: made.postId, slug: made.slug, status: "draft", slugs: [made.slug] };
    } catch (failure) {
      if (!isSlugTaken(failure)) throw failure;
      lastFailure = failure;
    }
  }
  throw lastFailure;
}

type ImageProblem = { key: string; values?: Record<string, number> };

/** Reads one new picture back from the bucket and checks it. `null` means it is fine. */
async function inspect(store: BlogStore, path: string): Promise<ImageProblem | null> {
  const bytes = await store.fetchImage(path);
  if (!bytes) return { key: "validation.blogImageMissing" };
  const info = readImageInfo(bytes);
  if (!info) return { key: "validation.blogImageType" };
  if (bytes.byteLength > BLOG_IMAGE_MAX_BYTES) {
    return { key: "validation.blogImageSize", values: { maximum: BLOG_IMAGE_MAX_KB } };
  }
  if (info.width > BLOG_IMAGE_MAX_SIDE || info.height > BLOG_IMAGE_MAX_SIDE) {
    return { key: "validation.blogImageTooLarge", values: { maximum: BLOG_IMAGE_MAX_SIDE } };
  }
  return null;
}

/**
 * Checks the pictures an article now uses: each must be in this article's folder, and each that the stored article did
 * not already use is read back from the bucket. Throws a validation error naming the first that fails.
 */
async function checkPictures(
  store: BlogStore,
  postId: string,
  wanted: readonly { path: string; field: string }[],
  already: ReadonlySet<string>,
): Promise<void> {
  const folder = blogImageFolder(postId);
  for (const { path, field } of wanted) {
    if (!path.startsWith(folder)) {
      throw new ActionError("VALIDATION", "A picture is not in this article's folder", {
        fieldErrors: { [field]: [{ key: "validation.blogImagePlace" }] },
      });
    }
  }
  const fresh = [
    ...new Map(wanted.filter(({ path }) => !already.has(path)).map((item) => [item.path, item])),
  ];
  const problems = await Promise.all(
    fresh.map(async ([path]) => [path, await inspect(store, path)] as const),
  );
  for (const [path, problem] of problems) {
    if (!problem) continue;
    const field = fresh.find(([key]) => key === path)?.[1].field ?? "body";
    throw new ActionError("VALIDATION", "A picture is not acceptable", {
      fieldErrors: { [field]: [problem] },
    });
  }
}

/** The pictures a stored article uses: its cover and its image blocks. */
function storedPictures(post: StoredPost): Set<string> {
  const paths = new Set(imagePathsOf(parseBody(post.body)));
  if (post.coverPath) paths.add(post.coverPath);
  return paths;
}

async function removeUnused(
  store: BlogStore,
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
  log?: Logger,
): Promise<void> {
  const gone = [...before].filter((path) => !after.has(path));
  if (gone.length === 0) return;
  try {
    await store.removeFiles(gone);
  } catch {
    log?.warn("blog pictures could not be removed", { count: gone.length });
  }
}

async function load(store: BlogStore, postId: string): Promise<StoredPost> {
  const post = await store.read(postId);
  if (!post) throw NOT_FOUND();
  return post;
}

/** A trashed article is not edited: it is restored first. It reads as not found here, like a foreign id. */
function assertEditable(post: StoredPost): void {
  if (post.deletedAt !== null) throw NOT_FOUND();
}

function done(post: StoredPost, slug: string, status: BlogStatus, extra: string[] = []): PostDone {
  return { postId: post.id, slug, status, slugs: [...new Set([post.slug, slug, ...extra])] };
}

function statusOf(post: StoredPost): BlogStatus {
  return isStatus(post.status) ? post.status : "draft";
}

/** Saves what the editor sends. The status, the cover and the Trash date are not in it. */
export async function savePost(
  store: BlogStore,
  input: UpdateBlogPostInput,
  log?: Logger,
): Promise<PostDone> {
  const post = await load(store, input.postId);
  assertEditable(post);

  const before = storedPictures(post);
  const used = imagePathsOf(input.body);
  await checkPictures(
    store,
    post.id,
    used.map((path) => ({ path, field: "body" })),
    before,
  );

  await store.update(post.id, {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body as unknown as NonNullable<Json>,
    category_id: input.categoryId,
    tags: input.tags,
    author_name: input.authorName,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
  });

  const after = new Set(used);
  if (post.coverPath) after.add(post.coverPath);
  await removeUnused(store, before, after, log);
  return done(post, input.slug, statusOf(post));
}

/** Sets the cover and its description, or removes the cover. */
export async function saveCover(
  store: BlogStore,
  input: SetBlogCoverInput,
  log?: Logger,
): Promise<PostDone> {
  const post = await load(store, input.postId);
  assertEditable(post);

  const before = storedPictures(post);
  if (input.coverPath !== null) {
    await checkPictures(store, post.id, [{ path: input.coverPath, field: "coverPath" }], before);
  }
  await store.update(post.id, { cover_path: input.coverPath, cover_alt: input.coverAlt });

  const after = new Set(imagePathsOf(parseBody(post.body)));
  if (input.coverPath) after.add(input.coverPath);
  await removeUnused(store, before, after, log);
  return done(post, post.slug, statusOf(post));
}

/** What a published article must have; the database checks the same. */
function publishProblems(post: StoredPost): Record<string, { key: string }[]> {
  const problems: Record<string, { key: string }[]> = {};
  if (post.excerpt.trim() === "") problems.excerpt = [{ key: "validation.blogNeedsExcerpt" }];
  if (parseBody(post.body).length === 0) problems.body = [{ key: "validation.blogNeedsBody" }];
  return problems;
}

/** Puts an article on the site. The first time, the database stamps the publish date. */
export async function publishPost(store: BlogStore, input: BlogPostIdInput): Promise<PostDone> {
  const post = await load(store, input.postId);
  assertEditable(post);
  const problems = publishProblems(post);
  if (Object.keys(problems).length > 0) {
    throw new ActionError("VALIDATION", "The article is not ready to publish", {
      fieldErrors: problems,
    });
  }
  await store.update(post.id, { status: "published" });
  return done(post, post.slug, "published");
}

/** Takes an article off the site and back to a draft. */
export async function unpublishPost(store: BlogStore, input: BlogPostIdInput): Promise<PostDone> {
  const post = await load(store, input.postId);
  assertEditable(post);
  await store.update(post.id, { status: "draft" });
  return done(post, post.slug, "draft");
}

/** Takes an article off the site and keeps it, out of the drafts. */
export async function archivePost(store: BlogStore, input: BlogPostIdInput): Promise<PostDone> {
  const post = await load(store, input.postId);
  assertEditable(post);
  await store.update(post.id, { status: "archived" });
  return done(post, post.slug, "archived");
}

/** Moves an article to Trash. A published one is unpublished with it (the table refuses a trashed published row). */
export async function trashPost(
  store: BlogStore,
  input: BlogPostIdInput,
  now: () => Date = () => new Date(),
): Promise<PostDone> {
  const post = await load(store, input.postId);
  if (post.deletedAt !== null) return done(post, post.slug, statusOf(post));
  const status = statusOf(post) === "published" ? "draft" : statusOf(post);
  await store.update(post.id, { status, deleted_at: now().toISOString() });
  return done(post, post.slug, status);
}

/** Brings an article back from Trash as it was (a published one comes back as a draft). */
export async function restorePost(store: BlogStore, input: BlogPostIdInput): Promise<PostDone> {
  const post = await load(store, input.postId);
  await store.update(post.id, { deleted_at: null });
  return done(post, post.slug, statusOf(post));
}
