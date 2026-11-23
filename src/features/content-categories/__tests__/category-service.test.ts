import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createCategory,
  deleteCategoryById,
  mapCategoryError,
  saveCategory,
  switchCategory,
  toCategoryRow,
  type CategoryStore,
} from "../category-service";
import { createCategorySchema, updateCategorySchema } from "../schemas";

const ID = "00000000-0000-4000-b300-000000000001";

function store(extra: Partial<CategoryStore> = {}): CategoryStore {
  const done = { categoryId: ID, module: "blog", slug: "buying-guide" };
  return {
    insert: vi.fn(async () => done),
    update: vi.fn(async () => done),
    setActive: vi.fn(async () => done),
    remove: vi.fn(async () => done),
    ...extra,
  };
}

describe("UT-content-category-service: the rules of the category manager (ADR-143)", () => {
  it("turns a new category into the columns the table has", () => {
    const input = createCategorySchema.parse({
      module: "department",
      name: "Sales",
      slug: "sales",
      sortOrder: 3,
      active: false,
    });
    expect(toCategoryRow(input)).toEqual({
      module: "department",
      slug: "sales",
      name: "Sales",
      sort_order: 3,
      active: false,
    });
  });

  it("creates through the store and answers what it answered", async () => {
    const made = store();
    const input = createCategorySchema.parse({ module: "blog", name: "Buying", slug: "buying" });
    await expect(createCategory(made, input)).resolves.toEqual({
      categoryId: ID,
      module: "blog",
      slug: "buying-guide",
    });
    expect(made.insert).toHaveBeenCalledWith({
      module: "blog",
      slug: "buying",
      name: "Buying",
      sort_order: 0,
      active: true,
    });
  });

  it("saves every column except the list", async () => {
    const made = store();
    const input = updateCategorySchema.parse({
      categoryId: ID,
      name: "Buying",
      slug: "buying",
      sortOrder: 2,
    });
    await saveCategory(made, input);
    expect(made.update).toHaveBeenCalledWith(ID, {
      slug: "buying",
      name: "Buying",
      sort_order: 2,
      active: true,
    });
  });

  it("switches and deletes by id", async () => {
    const made = store();
    await switchCategory(made, { categoryId: ID, active: false });
    await deleteCategoryById(made, { categoryId: ID });
    expect(made.setActive).toHaveBeenCalledWith(ID, false);
    expect(made.remove).toHaveBeenCalledWith(ID);
  });
});

describe("UT-content-category-errors: what the database says becomes a closed set of errors", () => {
  it("answers a used slug on the slug box", () => {
    const error = mapCategoryError({ code: "23505" });
    expect(error).toBeInstanceOf(ActionError);
    expect(error.code).toBe("VALIDATION");
    expect(error.fieldErrors).toEqual({ slug: [{ key: "validation.categorySlugTaken" }] });
  });

  it("answers a refused value, a missing category, a refusal by the policy and anything else", () => {
    expect(mapCategoryError({ code: "23514" }).code).toBe("VALIDATION");
    expect(mapCategoryError({ code: "P0002" }).code).toBe("NOT_FOUND");
    expect(mapCategoryError({ code: "PGRST116" }).code).toBe("NOT_FOUND");
    expect(mapCategoryError({ code: "42501" }).code).toBe("FORBIDDEN");
    const unknown = mapCategoryError({ code: "XX000", message: "secret detail" });
    expect(unknown.code).toBe("INTERNAL");
    expect(unknown.message).not.toContain("secret");
  });
});
