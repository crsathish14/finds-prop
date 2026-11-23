import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { categoryTag, readAdminCategories } from "../queries";

function client(result: { data: unknown; error: unknown }) {
  const calls: string[] = [];
  const query = {
    select: (columns: string) => {
      calls.push(`select:${columns}`);
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
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  const supabase = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
  return { supabase, calls };
}

describe("UT-content-category-queries: the category lists (ADR-143)", () => {
  it("shows a job department under the careers tag, and each other list under its own", () => {
    expect(categoryTag("blog")).toBe("blog");
    expect(categoryTag("faq")).toBe("faq");
    expect(categoryTag("department")).toBe("careers");
  });

  it("reads one list with the named columns, in the admin's order, and draws it", async () => {
    const { supabase, calls } = client({
      data: [
        { id: "b", module: "blog", slug: "loans", name: "Loans", sort_order: 2, active: false },
        { id: "a", module: "blog", slug: "buying", name: "Buying", sort_order: 1, active: true },
      ],
      error: null,
    });
    const views = await readAdminCategories(supabase, "blog");
    expect(calls).toEqual([
      "select:id, module, slug, name, sort_order, active",
      "eq:module=blog",
      "order:sort_order",
      "order:name",
    ]);
    expect(views.map((view) => [view.id, view.active])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("throws a failed read, so the portal's error page shows it", async () => {
    const failure = { code: "XX000", message: "down" };
    const { supabase } = client({ data: null, error: failure });
    await expect(readAdminCategories(supabase, "faq")).rejects.toBe(failure);
  });
});
