import { z } from "zod";
import {
  CATEGORY_MODULES,
  CATEGORY_NAME_MAX,
  CATEGORY_SLUG_MAX,
  CATEGORY_SORT_MAX,
} from "./constants";

/**
 * What the admin's category manager sends (ADR-143, FR-ADM-13 to FR-ADM-15). Nothing here says who is saving: the admin
 * is the signed-in session (R-BE-03). A schema message is a key under `validation.*`; the screen looks the words up
 * (ADR-035). The limits match the table's checks, so the database only refuses what the form could not see (a slug
 * already used in the list).
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

const details = {
  name: z.preprocess(
    tidy,
    z
      .string({ error: "validation.required" })
      .min(2, { error: "validation.required" })
      .max(CATEGORY_NAME_MAX, { error: "validation.invalid" }),
  ),
  slug: z
    .string({ error: "validation.categorySlugInvalid" })
    .trim()
    .min(2, { error: "validation.categorySlugInvalid" })
    .max(CATEGORY_SLUG_MAX, { error: "validation.categorySlugInvalid" })
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.categorySlugInvalid" }),
  sortOrder: z
    .number({ error: "validation.invalid" })
    .int({ error: "validation.invalid" })
    .min(0, { error: "validation.invalid" })
    .max(CATEGORY_SORT_MAX, { error: "validation.invalid" })
    .default(0),
  active: z.boolean({ error: "validation.invalid" }).default(true),
};

/** A new category. Its list (`module`) is fixed when it is made. */
export const createCategorySchema = z.object({
  module: z.enum(CATEGORY_MODULES, { error: "validation.invalid" }),
  ...details,
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/** Changes to a category that exists; moving it to another list is not allowed. */
export const updateCategorySchema = z.object({ categoryId: uuid, ...details });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/** Hides a category from the visitors' filters, or shows it again. */
export const setCategoryActiveSchema = z.object({
  categoryId: uuid,
  active: z.boolean({ error: "validation.invalid" }),
});
export type SetCategoryActiveInput = z.infer<typeof setCategoryActiveSchema>;

export const deleteCategorySchema = z.object({ categoryId: uuid });
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
