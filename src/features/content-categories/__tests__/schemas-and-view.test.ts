import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  deleteCategorySchema,
  setCategoryActiveSchema,
  updateCategorySchema,
} from "../schemas";
import { slugFromName, toCategoryViews } from "../view";

const ID = "00000000-0000-4000-b300-000000000001";

describe("UT-content-category-schemas: what the category manager may send (ADR-143)", () => {
  it("accepts a new category and fills in the order and the switch", () => {
    const parsed = createCategorySchema.parse({
      module: "blog",
      name: "  Buying   guide ",
      slug: "buying-guide",
    });
    expect(parsed).toEqual({
      module: "blog",
      name: "Buying guide",
      slug: "buying-guide",
      sortOrder: 0,
      active: true,
    });
  });

  it("accepts each of the three lists and nothing else", () => {
    for (const list of ["blog", "faq", "department"]) {
      expect(
        createCategorySchema.safeParse({ module: list, name: "Sales", slug: "sales" }).success,
      ).toBe(true);
    }
    expect(
      createCategorySchema.safeParse({ module: "news", name: "Sales", slug: "sales" }).success,
    ).toBe(false);
  });

  it.each(["Buying Guide", "a", "-start", "end-", "two--hyphens", "x".repeat(61), "ünï"])(
    "refuses the slug %j and puts the message on the slug box",
    (slug) => {
      const result = createCategorySchema.safeParse({ module: "faq", name: "Sales", slug });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((one) => one.path[0] === "slug");
        expect(issue?.message).toBe("validation.categorySlugInvalid");
      }
    },
  );

  it("refuses a blank or too long name and an order outside the table's range", () => {
    const base = { module: "faq", slug: "sales" };
    expect(createCategorySchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(createCategorySchema.safeParse({ ...base, name: "x".repeat(61) }).success).toBe(false);
    expect(createCategorySchema.safeParse({ ...base, name: "Sales", sortOrder: -1 }).success).toBe(
      false,
    );
    expect(
      createCategorySchema.safeParse({ ...base, name: "Sales", sortOrder: 10001 }).success,
    ).toBe(false);
    expect(createCategorySchema.safeParse({ ...base, name: "Sales", sortOrder: 1.5 }).success).toBe(
      false,
    );
  });

  it("keeps the list out of an update: a category is not moved to another list", () => {
    const parsed = updateCategorySchema.parse({
      categoryId: ID.toUpperCase(),
      module: "faq",
      name: "Sales",
      slug: "sales",
    });
    expect(parsed).not.toHaveProperty("module");
    expect(parsed.categoryId).toBe(ID);
  });

  it("needs a real id and a true or false for the switch and the delete", () => {
    expect(setCategoryActiveSchema.safeParse({ categoryId: "nope", active: true }).success).toBe(
      false,
    );
    expect(setCategoryActiveSchema.safeParse({ categoryId: ID, active: "yes" }).success).toBe(
      false,
    );
    expect(setCategoryActiveSchema.safeParse({ categoryId: ID, active: false }).success).toBe(true);
    expect(deleteCategorySchema.safeParse({ categoryId: ID }).success).toBe(true);
    expect(deleteCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe("UT-content-category-view: the rows as the pages draw them (ADR-143)", () => {
  const row = (extra: Partial<Parameters<typeof toCategoryViews>[0][number]> = {}) => ({
    id: ID,
    module: "blog",
    slug: "buying-guide",
    name: "Buying guide",
    sort_order: 0,
    active: true,
    ...extra,
  });

  it("orders by the sort order, then by name", () => {
    const views = toCategoryViews([
      row({ id: "a", name: "Zoning", sort_order: 1 }),
      row({ id: "b", name: "Loans", sort_order: 2 }),
      row({ id: "c", name: "Agreements", sort_order: 1 }),
    ]);
    expect(views.map((view) => view.id)).toEqual(["c", "a", "b"]);
  });

  it("names the columns the pages use and drops a row of an unknown list", () => {
    const views = toCategoryViews([row(), row({ id: "x", module: "news" })]);
    expect(views).toEqual([
      {
        id: ID,
        module: "blog",
        slug: "buying-guide",
        name: "Buying guide",
        sortOrder: 0,
        active: true,
      },
    ]);
  });
});

describe("UT-content-category-slug: the slug suggested from a name", () => {
  it.each([
    ["Buying guide", "buying-guide"],
    ["  Loans & EMIs!  ", "loans-emis"],
    ["Café Résumé", "cafe-resume"],
    ["---", ""],
  ])("turns %j into %j", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });

  it("cuts to the limit without leaving a trailing hyphen", () => {
    const slug = slugFromName("word ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
