import { tagsAfterJobChange } from "@/lib/cache-tags";
import type { JobDone } from "./job-service";
import { createJobSchema, jobIdSchema, updateJobSchema } from "./schemas";

/**
 * How the Careers admin actions run, kept apart from the "use server" file so a test can build them (ADR-143). Only a
 * super admin may call them, and each is limited with the admin's other edits (`admin_edit`, 600 an hour). No
 * idempotency key: a save sets values, so a repeat changes nothing more; a second "create" is a second draft with its
 * own address; a repeated status change finds the job already there. Every change refreshes the jobs list, the job's
 * own page and the sitemap (and the old address too, after a rename), so the AI assistant's reads follow at once. The
 * database records each change as `content.changed` (ids and changed column names, with the admin as the actor), so
 * there is no `audit` entry here.
 */
const refresh = (done: JobDone): string[] => [
  ...new Set(done.slugs.flatMap((slug) => tagsAfterJobChange(slug))),
];

export const createJobConfig = {
  name: "createJobPosting",
  input: createJobSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const updateJobConfig = {
  name: "updateJobPosting",
  input: updateJobSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const openJobConfig = {
  name: "openJobPosting",
  input: jobIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const closeJobConfig = {
  name: "closeJobPosting",
  input: jobIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const unpublishJobConfig = {
  name: "unpublishJobPosting",
  input: jobIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const trashJobConfig = {
  name: "trashJobPosting",
  input: jobIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const restoreJobConfig = {
  name: "restoreJobPosting",
  input: jobIdSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};
