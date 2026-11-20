import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createFaq,
  mapFaqError,
  publishFaqById,
  reorderFaqList,
  restoreFaqById,
  saveFaq,
  toFaqChanges,
  trashFaqById,
  unpublishFaqById,
  type FaqStore,
} from "../faq-service";
import { createFaqSchema, reorderFaqsSchema, updateFaqSchema } from "../schemas";

const FAQ = "00000000-0000-4000-a400-000000000001";
const CATEGORY = "00000000-0000-4000-b400-000000000001";

function store(extra: Partial<FaqStore> = {}): FaqStore {
  const done = { faqId: FAQ, categoryId: CATEGORY, status: "draft" as const };
  return {
    insert: vi.fn(async () => done),
    nextSortOrder: vi.fn(async () => 4),
    update: vi.fn(async () => done),
    setStatus: vi.fn(async (_id, status) => ({ ...done, status })),
    trash: vi.fn(async () => done),
    restore: vi.fn(async () => done),
    reorder: vi.fn(async (_category, ids) => ids.length),
    ...extra,
  };
}

const input = { categoryId: CATEGORY, question: "How do I list my property?", answer: "Sign in." };

describe("UT-faq-service: the rules of the FAQ admin (ADR-143)", () => {
  it("puts a new question last in its category, as a draft, unless the admin said otherwise", async () => {
    const made = store();
    await createFaq(made, createFaqSchema.parse(input));
    expect(made.nextSortOrder).toHaveBeenCalledWith(CATEGORY);
    expect(made.insert).toHaveBeenCalledWith({
      category_id: CATEGORY,
      question: "How do I list my property?",
      answer: "Sign in.",
      sort_order: 4,
      status: "draft",
    });
  });

  it("keeps a place and a status the admin chose, and does not look for the last place then", async () => {
    const made = store();
    await createFaq(made, createFaqSchema.parse({ ...input, sortOrder: 0, status: "published" }));
    expect(made.nextSortOrder).not.toHaveBeenCalled();
    expect(made.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0, status: "published" }),
    );
  });

  it("never places a question beyond the table's last place", async () => {
    const made = store({ nextSortOrder: vi.fn(async () => 10001) });
    await createFaq(made, createFaqSchema.parse(input));
    expect(made.insert).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 10000 }));
  });

  it("saves only what was sent: no place or status in the save means the question keeps its own", async () => {
    const parsed = updateFaqSchema.parse({ ...input, faqId: FAQ });
    expect(toFaqChanges(parsed)).toEqual({
      category_id: CATEGORY,
      question: "How do I list my property?",
      answer: "Sign in.",
    });
    const kept = store();
    await saveFaq(kept, parsed);
    expect(kept.update).toHaveBeenCalledWith(FAQ, toFaqChanges(parsed));
    expect(
      toFaqChanges(
        updateFaqSchema.parse({ ...input, faqId: FAQ, sortOrder: 3, status: "published" }),
      ),
    ).toEqual({
      category_id: CATEGORY,
      question: "How do I list my property?",
      answer: "Sign in.",
      sort_order: 3,
      status: "published",
    });
  });

  it("publishes, unpublishes, trashes and restores through the store, by id", async () => {
    const used = store();
    expect(await publishFaqById(used, { faqId: FAQ })).toMatchObject({ status: "published" });
    expect(await unpublishFaqById(used, { faqId: FAQ })).toMatchObject({ status: "draft" });
    await trashFaqById(used, { faqId: FAQ });
    await restoreFaqById(used, { faqId: FAQ });
    expect(used.setStatus).toHaveBeenNthCalledWith(1, FAQ, "published");
    expect(used.setStatus).toHaveBeenNthCalledWith(2, FAQ, "draft");
    expect(used.trash).toHaveBeenCalledWith(FAQ);
    expect(used.restore).toHaveBeenCalledWith(FAQ);
  });

  it("puts questions in order and answers the category and how many were placed", async () => {
    const used = store();
    const other = "00000000-0000-4000-a400-000000000002";
    await expect(
      reorderFaqList(used, reorderFaqsSchema.parse({ categoryId: CATEGORY, faqIds: [other, FAQ] })),
    ).resolves.toEqual({ categoryId: CATEGORY, count: 2 });
    expect(used.reorder).toHaveBeenCalledWith(CATEGORY, [other, FAQ]);
  });

  it("lets a failure of the store through unchanged", async () => {
    const failure = new ActionError("NOT_FOUND", "The question was not found");
    const broken = store({ update: vi.fn(async () => Promise.reject(failure)) });
    await expect(saveFaq(broken, updateFaqSchema.parse({ ...input, faqId: FAQ }))).rejects.toBe(
      failure,
    );
  });
});

describe("UT-faq-errors: what the database says becomes a closed set of action errors (ADR-143)", () => {
  it("puts a category that is not a FAQ category, or that does not exist, on the category box", () => {
    for (const failure of [
      { code: "23514", message: "a question belongs to a category of the FAQ list" },
      { code: "23503", message: "violates foreign key constraint" },
    ]) {
      const error = mapFaqError(failure);
      expect(error.code).toBe("VALIDATION");
      expect(error.fieldErrors).toEqual({ categoryId: [{ key: "validation.invalid" }] });
    }
  });

  it("puts any other refused value on the form as a whole", () => {
    for (const code of ["23514", "22023"]) {
      const error = mapFaqError({ code, message: "check constraint faqs_trashed_is_draft" });
      expect(error.code).toBe("VALIDATION");
      expect(error.fieldErrors).toEqual({ _form: [{ key: "validation.invalid" }] });
    }
  });

  it("answers not found for no matching row, forbidden for the policy, and a plain failure for the rest", () => {
    expect(mapFaqError({ code: "P0002" }).code).toBe("NOT_FOUND");
    expect(mapFaqError({ code: "PGRST116" }).code).toBe("NOT_FOUND");
    expect(mapFaqError({ code: "42501" }).code).toBe("FORBIDDEN");
    const unknown = mapFaqError({ code: "XX000", message: "secret detail" });
    expect(unknown.code).toBe("INTERNAL");
    expect(unknown.message).not.toContain("secret");
  });
});
