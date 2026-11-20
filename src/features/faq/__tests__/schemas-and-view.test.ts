import { describe, expect, it } from "vitest";
import { createFaqSchema, faqIdSchema, reorderFaqsSchema, updateFaqSchema } from "../schemas";
import {
  answerParagraphs,
  filterAdminFaqs,
  groupFaqs,
  toAdminFaqViews,
  toFaqViews,
  type FaqAdminView,
  type FaqView,
} from "../view";

const CATEGORY = "00000000-0000-4000-b400-000000000001";
const FAQ = "00000000-0000-4000-a400-000000000001";

describe("UT-faq-schemas: what the FAQ admin may send (ADR-143)", () => {
  it("accepts a new question and leaves the place and the status to the service", () => {
    const parsed = createFaqSchema.parse({
      categoryId: CATEGORY.toUpperCase(),
      question: "  How do I   list my property? ",
      answer: "Sign in first.",
    });
    expect(parsed).toEqual({
      categoryId: CATEGORY,
      question: "How do I list my property?",
      answer: "Sign in first.",
    });
  });

  it("keeps the paragraphs of an answer: one blank line between them, no stray spaces, never more", () => {
    const parsed = createFaqSchema.parse({
      categoryId: CATEGORY,
      question: "Which papers do I need?",
      answer: "\r\nFirst paragraph.   \r\n\r\n\r\n\r\nSecond paragraph.\n   \nThird.  \n",
    });
    expect(parsed.answer).toBe("First paragraph.\n\nSecond paragraph.\n\nThird.");
  });

  it("does not strip tags: the page draws an answer as text, so markup is shown and never run", () => {
    const parsed = createFaqSchema.parse({
      categoryId: CATEGORY,
      question: "Is <b>this</b> allowed?",
      answer: "<script>alert(1)</script> is only text here.",
    });
    expect(parsed.answer).toBe("<script>alert(1)</script> is only text here.");
  });

  it("refuses a question that is too short or too long, with the limit in the message", () => {
    const base = { categoryId: CATEGORY, answer: "A proper answer." };
    for (const [question, code, key] of [
      ["Why", "too_small", "minimum"],
      ["x".repeat(301), "too_big", "maximum"],
    ] as const) {
      const result = createFaqSchema.safeParse({ ...base, question });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((one) => one.path[0] === "question");
        expect(issue?.code).toBe(code);
        expect(issue).toHaveProperty(key);
      }
    }
  });

  it("refuses a blank answer and one over 5000 characters", () => {
    const base = { categoryId: CATEGORY, question: "A proper question?" };
    expect(createFaqSchema.safeParse({ ...base, answer: "  \n  " }).success).toBe(false);
    expect(createFaqSchema.safeParse({ ...base, answer: "x".repeat(5001) }).success).toBe(false);
    expect(createFaqSchema.safeParse({ ...base, answer: "x".repeat(5000) }).success).toBe(true);
  });

  it("asks for a real category id, a place inside the table's range and a status that exists", () => {
    const base = { question: "A proper question?", answer: "A proper answer." };
    expect(createFaqSchema.safeParse({ ...base, categoryId: "nope" }).success).toBe(false);
    expect(
      createFaqSchema.safeParse({ ...base, categoryId: CATEGORY, sortOrder: -1 }).success,
    ).toBe(false);
    expect(
      createFaqSchema.safeParse({ ...base, categoryId: CATEGORY, sortOrder: 10001 }).success,
    ).toBe(false);
    expect(
      createFaqSchema.safeParse({ ...base, categoryId: CATEGORY, sortOrder: 1.5 }).success,
    ).toBe(false);
    expect(
      createFaqSchema.safeParse({ ...base, categoryId: CATEGORY, status: "archived" }).success,
    ).toBe(false);
    expect(
      createFaqSchema.safeParse({
        ...base,
        categoryId: CATEGORY,
        status: "published",
        sortOrder: 0,
      }).success,
    ).toBe(true);
  });

  it("takes no owner, role or trash time from the caller: such fields are dropped", () => {
    const parsed = createFaqSchema.parse({
      categoryId: CATEGORY,
      question: "A proper question?",
      answer: "A proper answer.",
      deleted_at: "2026-01-01",
      deletedAt: "2026-01-01",
      authorId: "someone",
      role: "super_admin",
    });
    expect(Object.keys(parsed).sort()).toEqual(["answer", "categoryId", "question"]);
  });

  it("needs the id for an update, and the id alone for publish, unpublish, trash and restore", () => {
    const body = { categoryId: CATEGORY, question: "A proper question?", answer: "An answer." };
    expect(updateFaqSchema.safeParse(body).success).toBe(false);
    expect(updateFaqSchema.safeParse({ ...body, faqId: FAQ.toUpperCase() })).toMatchObject({
      success: true,
      data: { faqId: FAQ },
    });
    expect(faqIdSchema.safeParse({ faqId: FAQ }).success).toBe(true);
    expect(faqIdSchema.safeParse({ faqId: "nope" }).success).toBe(false);
    expect(faqIdSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a list of 1 to 200 different ids to put in order, and nothing else", () => {
    const other = "00000000-0000-4000-a400-000000000002";
    expect(
      reorderFaqsSchema.safeParse({ categoryId: CATEGORY, faqIds: [FAQ, other] }).success,
    ).toBe(true);
    expect(reorderFaqsSchema.safeParse({ categoryId: CATEGORY, faqIds: [] }).success).toBe(false);
    expect(reorderFaqsSchema.safeParse({ categoryId: CATEGORY, faqIds: [FAQ, FAQ] }).success).toBe(
      false,
    );
    expect(
      reorderFaqsSchema.safeParse({ categoryId: CATEGORY, faqIds: [FAQ, "nope"] }).success,
    ).toBe(false);
    const many = Array.from(
      { length: 201 },
      (_, index) => `00000000-0000-4000-a400-${String(index).padStart(12, "0")}`,
    );
    expect(reorderFaqsSchema.safeParse({ categoryId: CATEGORY, faqIds: many }).success).toBe(false);
    expect(
      reorderFaqsSchema.safeParse({ categoryId: CATEGORY, faqIds: many.slice(0, 200) }).success,
    ).toBe(true);
  });
});

function view(extra: Partial<FaqView> = {}): FaqView {
  return {
    id: FAQ,
    categoryId: CATEGORY,
    categorySlug: "buyers",
    categoryName: "Buyers",
    question: "How do I list my property?",
    answer: "Sign in first.",
    sortOrder: 1,
    updatedAt: "2026-11-20T10:00:00Z",
    ...extra,
  };
}

describe("UT-faq-view: the rows as the pages draw them (ADR-143)", () => {
  it("turns the search function's rows into views and keeps the order the function gave", () => {
    const views = toFaqViews([
      {
        id: "b",
        category_id: CATEGORY,
        category_slug: "buyers",
        category_name: "Buyers",
        question: "Second?",
        answer: "Yes.",
        sort_order: 2,
        updated_at: "2026-11-20T10:00:00Z",
      },
      {
        id: "a",
        category_id: CATEGORY,
        category_slug: "buyers",
        category_name: "Buyers",
        question: "First?",
        answer: "Yes.",
        sort_order: 1,
        updated_at: "2026-11-20T10:00:00Z",
      },
    ]);
    expect(views.map((one) => one.id)).toEqual(["b", "a"]);
    expect(views[0]).toEqual({
      id: "b",
      categoryId: CATEGORY,
      categorySlug: "buyers",
      categoryName: "Buyers",
      question: "Second?",
      answer: "Yes.",
      sortOrder: 2,
      updatedAt: "2026-11-20T10:00:00Z",
    });
  });

  it("groups by category in order of first appearance, questions in the order given", () => {
    const groups = groupFaqs([
      view({ id: "1", question: "One?" }),
      view({ id: "2", categorySlug: "sellers", categoryName: "Sellers", question: "Two?" }),
      view({ id: "3", question: "Three?" }),
    ]);
    expect(
      groups.map((group) => [group.slug, group.name, group.items.map((one) => one.id)]),
    ).toEqual([
      ["buyers", "Buyers", ["1", "3"]],
      ["sellers", "Sellers", ["2"]],
    ]);
    expect(groupFaqs([])).toEqual([]);
  });

  it("splits an answer into paragraphs at blank lines and drops empty ones", () => {
    expect(answerParagraphs("One.\n\nTwo\nstill two.\n\n\n\nThree.")).toEqual([
      "One.",
      "Two\nstill two.",
      "Three.",
    ]);
    expect(answerParagraphs("  \n\n ")).toEqual([]);
  });
});

function adminRow(extra: Partial<FaqAdminView> = {}): FaqAdminView {
  return {
    id: FAQ,
    categoryId: CATEGORY,
    question: "How do I list my property?",
    answer: "Sign in first, then choose Post a property.",
    sortOrder: 1,
    status: "published",
    deletedAt: null,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
    ...extra,
  };
}

describe("UT-faq-admin-view: the admin's list (ADR-143)", () => {
  it("orders by place then by age, and reads any unknown status as a draft", () => {
    const views = toAdminFaqViews([
      {
        id: "late",
        category_id: CATEGORY,
        question: "Late?",
        answer: "Yes.",
        sort_order: 1,
        status: "published",
        deleted_at: null,
        created_at: "2026-11-02T10:00:00Z",
        updated_at: "2026-11-02T10:00:00Z",
      },
      {
        id: "early",
        category_id: CATEGORY,
        question: "Early?",
        answer: "Yes.",
        sort_order: 1,
        status: "odd",
        deleted_at: null,
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      },
      {
        id: "first",
        category_id: CATEGORY,
        question: "First?",
        answer: "Yes.",
        sort_order: 0,
        status: "draft",
        deleted_at: "2026-11-05T10:00:00Z",
        created_at: "2026-11-03T10:00:00Z",
        updated_at: "2026-11-03T10:00:00Z",
      },
    ]);
    expect(views.map((one) => one.id)).toEqual(["first", "early", "late"]);
    expect(views.map((one) => one.status)).toEqual(["draft", "draft", "published"]);
    expect(views[0]?.deletedAt).toBe("2026-11-05T10:00:00Z");
  });

  const rows = [
    adminRow({ id: "pub", question: "How do I list my property?" }),
    adminRow({
      id: "draft",
      status: "draft",
      question: "What is a draft?",
      answer: "Not published yet.",
    }),
    adminRow({
      id: "other",
      categoryId: "00000000-0000-4000-b400-000000000002",
      question: "Can sellers edit?",
      answer: "Yes, from the dashboard.",
    }),
    adminRow({
      id: "gone",
      status: "draft",
      deletedAt: "2026-11-05T10:00:00Z",
      question: "Removed?",
    }),
  ];
  const ids = (filters: Parameters<typeof filterAdminFaqs>[1]) =>
    filterAdminFaqs(rows, filters).map((one) => one.id);

  it("shows everything outside the trash by default, and only the trash on its own tab", () => {
    expect(ids({})).toEqual(["pub", "draft", "other"]);
    expect(ids({ view: "all" })).toEqual(["pub", "draft", "other"]);
    expect(ids({ view: "trash" })).toEqual(["gone"]);
  });

  it("filters by status, by category and by words in the question or the answer, in any case", () => {
    expect(ids({ view: "published" })).toEqual(["pub", "other"]);
    expect(ids({ view: "draft" })).toEqual(["draft"]);
    expect(ids({ categoryId: "00000000-0000-4000-b400-000000000002" })).toEqual(["other"]);
    expect(ids({ query: "DASHBOARD" })).toEqual(["other"]);
    expect(ids({ query: "published yet" })).toEqual(["draft"]);
    expect(ids({ query: "  " })).toEqual(["pub", "draft", "other"]);
    expect(ids({ query: "nothing like this" })).toEqual([]);
    expect(ids({ view: "published", query: "sellers", categoryId: CATEGORY })).toEqual([]);
  });
});
