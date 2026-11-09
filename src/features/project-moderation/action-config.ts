import { tagsAfterProjectChange } from "@/lib/cache-tags";
import { deleteProjectSchema, moderateProjectSchema } from "./schemas";

/**
 * How the admin's project decisions run, kept apart from the "use server" file so a test can build them (S7-T04).
 * Only a super admin may call them. They are limited to 120 per admin per hour (`admin_decision`, with the admin's
 * other decisions): a busy morning of reviewing is well inside it, and a stuck script is not. No idempotency key: a
 * second, identical decision finds the project already in the new state and the database answers with a conflict,
 * and a second delete finds nothing to delete, so nothing is written twice. Every decision changes what the public
 * pages show (an approved and published project appears, a rejected or unpublished one leaves), and so does a
 * delete, so the tags of the lists and of that project's page are refreshed. The change is recorded in the audit
 * log by the database (`project.moderation_changed`, `project.deleted`), with the admin as the actor, so there is no
 * `audit` entry here.
 */
export const moderateProjectConfig = {
  name: "moderateProject",
  input: moderateProjectSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
  invalidate: (result: { slug: string }) => tagsAfterProjectChange(result.slug),
};

export const deleteProjectConfig = {
  name: "deleteProject",
  input: deleteProjectSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
  invalidate: (result: { slug: string }) => tagsAfterProjectChange(result.slug),
};
