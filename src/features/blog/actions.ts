"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  archiveBlogPostConfig,
  createBlogPostConfig,
  publishBlogPostConfig,
  restoreBlogPostConfig,
  setBlogCoverConfig,
  trashBlogPostConfig,
  unpublishBlogPostConfig,
  updateBlogPostConfig,
} from "./action-config";
import {
  archivePost,
  createPost,
  publishPost,
  restorePost,
  saveCover,
  savePost,
  trashPost,
  unpublishPost,
} from "./post-service";
import { createBlogStore } from "./service";

// defineAction has already refused anyone who is not a super admin; the checks below only keep the type honest.
function assertSession(session: unknown): void {
  if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
}

/** Makes a draft article, as the signed-in super admin. Answers its id, address and status. */
export const createBlogPost = defineAction({
  ...createBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await createPost(await createBlogStore(), input);
    log.info("blog post created", { postId: done.postId });
    return done;
  },
});

/** Saves the editor: the words, the blocks, the category, the tags and the search description. */
export const updateBlogPost = defineAction({
  ...updateBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await savePost(await createBlogStore(), input, log);
    log.info("blog post saved", { postId: done.postId });
    return done;
  },
});

/** Sets the cover picture (already in the bucket) and its description, or removes the cover. */
export const setBlogCover = defineAction({
  ...setBlogCoverConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await saveCover(await createBlogStore(), input, log);
    log.info("blog cover saved", { postId: done.postId, removed: input.coverPath === null });
    return done;
  },
});

/** Puts an article on the site. */
export const publishBlogPost = defineAction({
  ...publishBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await publishPost(await createBlogStore(), input);
    log.info("blog post published", { postId: done.postId });
    return done;
  },
});

/** Takes an article off the site and back to a draft. */
export const unpublishBlogPost = defineAction({
  ...unpublishBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await unpublishPost(await createBlogStore(), input);
    log.info("blog post unpublished", { postId: done.postId });
    return done;
  },
});

/** Takes an article off the site and keeps it as archived. */
export const archiveBlogPost = defineAction({
  ...archiveBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await archivePost(await createBlogStore(), input);
    log.info("blog post archived", { postId: done.postId });
    return done;
  },
});

/** Moves an article to Trash (soft delete). */
export const trashBlogPost = defineAction({
  ...trashBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await trashPost(await createBlogStore(), input);
    log.info("blog post trashed", { postId: done.postId });
    return done;
  },
});

/** Brings an article back from Trash. */
export const restoreBlogPost = defineAction({
  ...restoreBlogPostConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await restorePost(await createBlogStore(), input);
    log.info("blog post restored", { postId: done.postId });
    return done;
  },
});
