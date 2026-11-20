import { tagsAfterBlogChange } from "@/lib/cache-tags";
import type { PostDone } from "./post-service";
import {
  blogPostIdSchema,
  createBlogPostSchema,
  setBlogCoverSchema,
  updateBlogPostSchema,
} from "./schemas";

/**
 * How the Blog's admin actions run, kept apart from the "use server" file so a test can build them (ADR-143). Only a
 * super admin may call them, and each is limited with the admin's other edits (`admin_edit`, 600 an hour). No
 * idempotency key: a save sets values, so a repeat changes nothing more; a second "create" is a second draft with its
 * own address; a repeated status change finds the article already there. Every change refreshes the Blog's list, the
 * article's own page and the sitemap (and the old address too, after a rename), so the AI assistant's reads follow at
 * once. The database records each change as `content.changed` (ids and changed column names, with the admin as the
 * actor), so there is no `audit` entry here.
 */
const refresh = (done: PostDone): string[] => [
  ...new Set(done.slugs.flatMap((slug) => tagsAfterBlogChange(slug))),
];

export const createBlogPostConfig = {
  name: "createBlogPost",
  input: createBlogPostSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const updateBlogPostConfig = {
  name: "updateBlogPost",
  input: updateBlogPostSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const setBlogCoverConfig = {
  name: "setBlogCover",
  input: setBlogCoverSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const publishBlogPostConfig = {
  name: "publishBlogPost",
  input: blogPostIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const unpublishBlogPostConfig = {
  name: "unpublishBlogPost",
  input: blogPostIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const archiveBlogPostConfig = {
  name: "archiveBlogPost",
  input: blogPostIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const trashBlogPostConfig = {
  name: "trashBlogPost",
  input: blogPostIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const restoreBlogPostConfig = {
  name: "restoreBlogPost",
  input: blogPostIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};
