import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the store below takes its client directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { faqStore } = await import("@/features/faq/service");
const {
  createFaq,
  publishFaqById,
  reorderFaqList,
  restoreFaqById,
  saveFaq,
  trashFaqById,
  unpublishFaqById,
} = await import("@/features/faq/faq-service");
const { createFaqSchema, reorderFaqsSchema, updateFaqSchema } =
  await import("@/features/faq/schemas");
const { readAdminFaqs, searchFaqs } = await import("@/features/faq/queries");
const { ActionError } = await import("@/server/actions/normalise-error");

// ADR-143 phase 2, IT-faq: the FAQ admin's store and the public search, against a real database. Every row belongs to
// this run's own categories, so nothing else in the database is touched, and the rows are removed at the end.

const RUN = randomUUID().slice(0, 8);

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-faq: the FAQ module against a real database (ADR-143)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let customer: TestUser;
  let categoryId = "";
  let hiddenCategoryId = "";
  let blogCategoryId = "";
  const slug = `it-faq-${RUN}`;

  const visible = async (text?: string) =>
    (await searchFaqs(visitorClient(), { categorySlug: slug, query: text })).map(
      (view) => view.question,
    );

  async function addCategory(module: string, name: string, active: boolean, suffix: string) {
    const { data, error } = await admin
      .from("content_categories")
      .insert({ module, slug: `${slug}${suffix}`, name, active })
      .select("id")
      .single();
    if (error) throw new Error(`Could not add the category (${error.code})`);
    return data.id;
  }

  beforeAll(async () => {
    staff = await signInTestAdmin();
    customer = await signInTestCustomer();
    categoryId = await addCategory("faq", `Questions ${RUN}`, true, "");
    hiddenCategoryId = await addCategory("faq", `Hidden ${RUN}`, false, "-hidden");
    blogCategoryId = await addCategory("blog", `Blog ${RUN}`, true, "-blog");
  });

  afterAll(async () => {
    const ids = [categoryId, hiddenCategoryId, blogCategoryId].filter(Boolean);
    await admin.from("faqs").delete().in("category_id", ids);
    await admin.from("content_categories").delete().in("id", ids);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("adds drafts last in their category, and a visitor sees none of them", async () => {
    const store = faqStore(staff.client);
    const first = await createFaq(
      store,
      createFaqSchema.parse({
        categoryId,
        question: "How do I list my property?",
        answer: "Sign in, then choose Post a property.\n\nFill in the steps.",
      }),
    );
    const second = await createFaq(
      store,
      createFaqSchema.parse({
        categoryId,
        question: "Which papers do I need?",
        answer: "Keep the sale deed and an identity proof ready.",
      }),
    );
    expect(first.status).toBe("draft");
    const { data } = await admin
      .from("faqs")
      .select("id, sort_order")
      .in("id", [first.faqId, second.faqId])
      .order("sort_order");
    expect(data?.map((row) => [row.id, row.sort_order])).toEqual([
      [first.faqId, 1],
      [second.faqId, 2],
    ]);
    expect(await visible()).toEqual([]);
  });

  it("publishes and unpublishes: a visitor sees a question exactly while it is published", async () => {
    const store = faqStore(staff.client);
    const rows = await readAdminFaqs(staff.client, { trashed: false });
    const mine = rows.filter((row) => row.categoryId === categoryId);
    expect(mine).toHaveLength(2);
    const [first, second] = mine;
    if (!first || !second) throw new Error("expected two questions");

    await publishFaqById(store, { faqId: first.id });
    await publishFaqById(store, { faqId: second.id });
    expect(await visible()).toEqual(["How do I list my property?", "Which papers do I need?"]);
    expect(await visible("sale deed")).toEqual(["Which papers do I need?"]);
    expect(await visible("properties")).toEqual(["How do I list my property?"]);

    await unpublishFaqById(store, { faqId: second.id });
    expect(await visible()).toEqual(["How do I list my property?"]);
  });

  it("puts questions in order, and refuses a list that holds a question of another category", async () => {
    const store = faqStore(staff.client);
    const mine = (await readAdminFaqs(staff.client, { trashed: false })).filter(
      (row) => row.categoryId === categoryId,
    );
    const ids = mine.map((row) => row.id).reverse();
    expect(
      await reorderFaqList(store, reorderFaqsSchema.parse({ categoryId, faqIds: ids })),
    ).toEqual({ categoryId, count: 2 });
    const after = (await readAdminFaqs(staff.client, { trashed: false })).filter(
      (row) => row.categoryId === categoryId,
    );
    expect(after.map((row) => row.id)).toEqual(ids);

    const other = await createFaq(
      store,
      createFaqSchema.parse({
        categoryId: hiddenCategoryId,
        question: "A question in a hidden category",
        answer: "Nobody but the admin sees this.",
      }),
    );
    const foreign = await failureOf(() =>
      reorderFaqList(store, reorderFaqsSchema.parse({ categoryId, faqIds: [...ids, other.faqId] })),
    );
    expect(foreign.code).toBe("NOT_FOUND");
    const unchanged = (await readAdminFaqs(staff.client, { trashed: false })).filter(
      (row) => row.categoryId === categoryId,
    );
    expect(unchanged.map((row) => row.id)).toEqual(ids);
  });

  it("hides a published question whose category is switched off, and shows it again when it is on", async () => {
    const store = faqStore(staff.client);
    const made = await createFaq(
      store,
      createFaqSchema.parse({
        categoryId: hiddenCategoryId,
        question: "A published question in a hidden category",
        answer: "The category is off, so this stays off the page.",
        status: "published",
      }),
    );
    const hiddenSlug = `${slug}-hidden`;
    const asVisitor = await searchFaqs(visitorClient(), { categorySlug: hiddenSlug });
    expect(asVisitor).toEqual([]);
    await admin.from("content_categories").update({ active: true }).eq("id", hiddenCategoryId);
    const afterSwitch = await searchFaqs(visitorClient(), { categorySlug: hiddenSlug });
    expect(afterSwitch.map((view) => view.id)).toEqual([made.faqId]);
    await admin.from("content_categories").update({ active: false }).eq("id", hiddenCategoryId);
  });

  it("trashes a published question back to a draft, refuses to edit it there, and restores it as a draft", async () => {
    const store = faqStore(staff.client);
    const [first] = (await readAdminFaqs(staff.client, { trashed: false })).filter(
      (row) => row.categoryId === categoryId && row.status === "published",
    );
    if (!first) throw new Error("expected a published question");

    const trashed = await trashFaqById(store, { faqId: first.id });
    expect(trashed.status).toBe("draft");
    expect(await visible()).toEqual([]);
    const inTrash = await readAdminFaqs(staff.client, { trashed: true });
    expect(inTrash.map((row) => row.id)).toContain(first.id);
    expect(inTrash.find((row) => row.id === first.id)?.deletedAt).not.toBeNull();

    const edit = await failureOf(() =>
      saveFaq(
        store,
        updateFaqSchema.parse({
          faqId: first.id,
          categoryId,
          question: first.question,
          answer: "An edit that must be refused.",
        }),
      ),
    );
    expect(edit.code).toBe("NOT_FOUND");
    expect((await failureOf(() => trashFaqById(store, { faqId: first.id }))).code).toBe(
      "NOT_FOUND",
    );

    const restored = await restoreFaqById(store, { faqId: first.id });
    expect(restored.status).toBe("draft");
    expect(await visible()).toEqual([]);
    expect((await failureOf(() => restoreFaqById(store, { faqId: first.id }))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("keeps a question in the FAQ list: a blog category, or one that does not exist, is refused on the category box", async () => {
    const store = faqStore(staff.client);
    const body = { question: "A question for the wrong list", answer: "This must be refused." };
    for (const wrong of [blogCategoryId, randomUUID()]) {
      const refused = await failureOf(() =>
        createFaq(store, createFaqSchema.parse({ ...body, categoryId: wrong })),
      );
      expect(refused.code).toBe("VALIDATION");
      expect(refused.fieldErrors).toEqual({ categoryId: [{ key: "validation.invalid" }] });
    }
  });

  it("lets nobody but the super admin write: a customer's store is refused by the database", async () => {
    const store = faqStore(customer.client);
    const refused = await failureOf(() =>
      createFaq(
        store,
        createFaqSchema.parse({
          categoryId,
          question: "A question from a customer",
          answer: "This must be refused.",
        }),
      ),
    );
    expect(refused.code).toBe("FORBIDDEN");
    const [any] = await readAdminFaqs(staff.client, { trashed: false });
    if (!any) throw new Error("expected a question");
    expect((await failureOf(() => trashFaqById(store, { faqId: any.id }))).code).toBe("NOT_FOUND");
    expect((await failureOf(() => publishFaqById(store, { faqId: any.id }))).code).toBe(
      "NOT_FOUND",
    );
    expect(
      (
        await failureOf(() =>
          reorderFaqList(store, reorderFaqsSchema.parse({ categoryId, faqIds: [any.id] })),
        )
      ).code,
    ).toBe("NOT_FOUND");
  });

  it("records every change as content.changed with the admin as the actor, and never the text", async () => {
    const { data, error } = await admin
      .from("audit_log")
      .select("actor_id, diff, entity_id")
      .eq("action", "content.changed")
      .eq("entity_type", "faq")
      .order("created_at");
    if (error) throw new Error(`Could not read the audit log (${error.code})`);
    const mine = data.filter((entry) => entry.actor_id === staff.userId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((entry) => JSON.stringify(entry.diff).includes('"created"'))).toBe(true);
    expect(mine.some((entry) => JSON.stringify(entry.diff).includes('"deleted_at"'))).toBe(true);
    for (const entry of mine) {
      const text = JSON.stringify(entry.diff);
      expect(text).not.toContain("sale deed");
      expect(text).not.toContain("search_vector");
    }
  });
});
