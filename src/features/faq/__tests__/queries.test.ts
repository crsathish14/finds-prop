import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { readAdminFaq, readAdminFaqs, searchFaqs } from "../queries";

const row = {
  id: "a",
  category_id: "c",
  category_slug: "buyers",
  category_name: "Buyers",
  question: "How do I list my property?",
  answer: "Sign in first.",
  sort_order: 1,
  updated_at: "2026-11-20T10:00:00Z",
};

function rpcClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => result);
  return { rpc, supabase: { rpc } as unknown as SupabaseClient<Database> };
}

function tableClient(result: { data: unknown; error: unknown }) {
  const calls: string[] = [];
  const query: Record<string, unknown> = {
    select: (columns: string) => {
      calls.push(`select:${columns}`);
      return query;
    },
    is: (column: string, value: unknown) => {
      calls.push(`is:${column}=${String(value)}`);
      return query;
    },
    not: (column: string, operator: string, value: unknown) => {
      calls.push(`not:${column} ${operator} ${String(value)}`);
      return query;
    },
    eq: (column: string, value: string) => {
      calls.push(`eq:${column}=${value}`);
      return query;
    },
    order: (column: string) => {
      calls.push(`order:${column}`);
      return query;
    },
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  const supabase = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
  return { supabase, calls };
}

describe("UT-faq-queries: the public read shared by the page and the assistant (ADR-143)", () => {
  it("asks the search function for everything, up to the limit, when there are no words", async () => {
    const { rpc, supabase } = rpcClient({ data: [row], error: null });
    const views = await searchFaqs(supabase);
    expect(rpc).toHaveBeenCalledWith("search_faqs", { p_limit: 200 });
    expect(views).toEqual([
      {
        id: "a",
        categoryId: "c",
        categorySlug: "buyers",
        categoryName: "Buyers",
        question: "How do I list my property?",
        answer: "Sign in first.",
        sortOrder: 1,
        updatedAt: "2026-11-20T10:00:00Z",
      },
    ]);
  });

  it("passes the words (trimmed), the category's slug and the limit through", async () => {
    const { rpc, supabase } = rpcClient({ data: [], error: null });
    await searchFaqs(supabase, { query: "  sale deed  ", categorySlug: "buyers", limit: 5 });
    expect(rpc).toHaveBeenCalledWith("search_faqs", {
      p_query: "sale deed",
      p_category: "buyers",
      p_limit: 5,
    });
  });

  it("leaves out a search that is only spaces, and cuts a long paste at the database's limit", async () => {
    const { rpc, supabase } = rpcClient({ data: [], error: null });
    await searchFaqs(supabase, { query: "   ", categorySlug: "" });
    expect(rpc).toHaveBeenLastCalledWith("search_faqs", { p_limit: 200 });
    await searchFaqs(supabase, { query: "x".repeat(500) });
    expect(rpc).toHaveBeenLastCalledWith("search_faqs", { p_query: "x".repeat(200), p_limit: 200 });
  });

  it("throws a failed read, so the caller decides what the visitor sees", async () => {
    const failure = { code: "XX000", message: "down" };
    const { supabase } = rpcClient({ data: null, error: failure });
    await expect(searchFaqs(supabase)).rejects.toBe(failure);
  });
});

describe("UT-faq-admin-queries: the admin's reads (ADR-143)", () => {
  const record = {
    id: "a",
    category_id: "c",
    question: "How do I list my property?",
    answer: "Sign in first.",
    sort_order: 1,
    status: "draft",
    deleted_at: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };
  const columns =
    "select:id, category_id, question, answer, sort_order, status, deleted_at, created_at, updated_at";

  it("reads the questions outside the trash with the named columns, without the search vector", async () => {
    const { supabase, calls } = tableClient({ data: [record], error: null });
    const views = await readAdminFaqs(supabase, { trashed: false });
    expect(calls).toEqual([columns, "is:deleted_at=null", "order:sort_order", "order:created_at"]);
    expect(views.map((view) => [view.id, view.status])).toEqual([["a", "draft"]]);
  });

  it("reads only the trash for the trash tab", async () => {
    const { supabase, calls } = tableClient({ data: [], error: null });
    await readAdminFaqs(supabase, { trashed: true });
    expect(calls).toEqual([
      columns,
      "not:deleted_at is null",
      "order:sort_order",
      "order:created_at",
    ]);
  });

  it("throws a failed read, so the portal's error page shows it", async () => {
    const failure = { code: "XX000", message: "down" };
    const { supabase } = tableClient({ data: null, error: failure });
    await expect(readAdminFaqs(supabase, { trashed: false })).rejects.toBe(failure);
  });

  it("reads one question by id, or answers null when there is none", async () => {
    const found = tableClient({ data: record, error: null });
    expect((await readAdminFaq(found.supabase, "a"))?.id).toBe("a");
    expect(found.calls).toEqual([columns, "eq:id=a"]);
    const missing = tableClient({ data: null, error: null });
    expect(await readAdminFaq(missing.supabase, "zzz")).toBeNull();
  });
});
