"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createFaqConfig,
  publishFaqConfig,
  reorderFaqsConfig,
  restoreFaqConfig,
  trashFaqConfig,
  unpublishFaqConfig,
  updateFaqConfig,
} from "./action-config";
import {
  createFaq as makeFaq,
  publishFaqById,
  reorderFaqList,
  restoreFaqById,
  saveFaq,
  trashFaqById,
  unpublishFaqById,
} from "./faq-service";
import { createFaqStore } from "./service";

/**
 * Every action here is for the super admin only: defineAction has already refused anyone else before the handler runs,
 * so the `session` check in each handler only keeps the type honest.
 */

/** Adds a question (a draft unless the admin chose otherwise, last in its category unless a place was given). */
export const createFaq = defineAction({
  ...createFaqConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await makeFaq(await createFaqStore(), input);
    log.info("faq created", { faqId: done.faqId, status: done.status });
    return done;
  },
});

/** Saves changes to a question that is not in the trash. */
export const updateFaq = defineAction({
  ...updateFaqConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveFaq(await createFaqStore(), input);
    log.info("faq saved", { faqId: done.faqId, status: done.status });
    return done;
  },
});

/** Shows a question on the website and to the assistant. */
export const publishFaq = defineAction({
  ...publishFaqConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await publishFaqById(await createFaqStore(), input);
    log.info("faq published", { faqId: done.faqId });
    return done;
  },
});

/** Takes a question off the website and from the assistant; it stays as a draft. */
export const unpublishFaq = defineAction({
  ...unpublishFaqConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await unpublishFaqById(await createFaqStore(), input);
    log.info("faq unpublished", { faqId: done.faqId });
    return done;
  },
});

/** Moves a question to the trash (and back to a draft). A later job removes old trash for good. */
export const trashFaq = defineAction({
  ...trashFaqConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await trashFaqById(await createFaqStore(), input);
    log.info("faq trashed", { faqId: done.faqId });
    return done;
  },
});

/** Takes a question out of the trash. It comes back as a draft. */
export const restoreFaq = defineAction({
  ...restoreFaqConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await restoreFaqById(await createFaqStore(), input);
    log.info("faq restored", { faqId: done.faqId });
    return done;
  },
});

/** Puts the questions of a category in the order the admin gave. */
export const reorderFaqs = defineAction({
  ...reorderFaqsConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await reorderFaqList(await createFaqStore(), input);
    log.info("faqs reordered", { categoryId: done.categoryId, count: done.count });
    return done;
  },
});
