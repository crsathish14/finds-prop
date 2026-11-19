import { tagsAfterContentCategoryChange } from "@/lib/cache-tags";
import {
  createCategorySchema,
  deleteCategorySchema,
  setCategoryActiveSchema,
  updateCategorySchema,
} from "./schemas";

/**
 * How the admin's category actions run, kept apart from the "use server" file so a test can build them (ADR-143). Only
 * a super admin may call them, and each is limited with the admin's other edits (`admin_edit`, 600 an hour). No
 * idempotency key: saving sets values, so a repeat changes nothing more; a second "create" with the same slug is refused
 * by the database (the slug is unique in its list); a second delete finds nothing to delete. A category appears in the
 * filters of the Blog, the FAQ and Careers, so every change refreshes the three modules' cache tags. The database
 * records each change as `content.changed` (ids and changed column names, with the admin as the actor), so there is no
 * `audit` entry here.
 */
const refresh = (): string[] => tagsAfterContentCategoryChange();

export const createCategoryConfig = {
  name: "createContentCategory",
  input: createCategorySchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const updateCategoryConfig = {
  name: "updateContentCategory",
  input: updateCategorySchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const setCategoryActiveConfig = {
  name: "setContentCategoryActive",
  input: setCategoryActiveSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const deleteCategoryConfig = {
  name: "deleteContentCategory",
  input: deleteCategorySchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};
