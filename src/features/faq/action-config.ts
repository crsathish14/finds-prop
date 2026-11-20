import { tagsAfterFaqChange } from "@/lib/cache-tags";
import { createFaqSchema, faqIdSchema, reorderFaqsSchema, updateFaqSchema } from "./schemas";

/**
 * How the admin's FAQ actions run, kept apart from the "use server" file so a test can build them (ADR-143). Only a
 * super admin may call them, and each is limited with the admin's other edits (`admin_edit`, 600 an hour). No
 * idempotency key: saving sets values, so a repeat changes nothing more; publish, unpublish, trash and restore set a
 * state, so doing one twice leaves the same state; a second "create" makes a second draft, which the admin sees in the
 * list and can trash. A change refreshes the `faq` tag, which holds the page, its structured data, the sitemap entry
 * and the assistant's reads. The database records each change as `content.changed` (the id and the changed column
 * names, with the admin as the actor), so there is no `audit` entry here.
 */
const refresh = (): string[] => tagsAfterFaqChange();

export const createFaqConfig = {
  name: "createFaq",
  input: createFaqSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const updateFaqConfig = {
  name: "updateFaq",
  input: updateFaqSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const publishFaqConfig = {
  name: "publishFaq",
  input: faqIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const unpublishFaqConfig = {
  name: "unpublishFaq",
  input: faqIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const trashFaqConfig = {
  name: "trashFaq",
  input: faqIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const restoreFaqConfig = {
  name: "restoreFaq",
  input: faqIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const reorderFaqsConfig = {
  name: "reorderFaqs",
  input: reorderFaqsSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};
