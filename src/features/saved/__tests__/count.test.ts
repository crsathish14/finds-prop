import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  answer: { count: 0 as number | null, error: null as null | { code: string } },
  asked: [] as string[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/property", () => ({ getProperty: vi.fn() }));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => db.logged.push(args) },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: (table: string) => ({
      select: async (columns: string, options: unknown) => {
        db.asked.push(`${table}:${columns}:${JSON.stringify(options)}`);
        return db.answer;
      },
    }),
  }),
}));

const { countSavedHomes } = await import("../queries");

beforeEach(() => {
  db.answer = { count: 0, error: null };
  db.asked = [];
  db.logged = [];
});

describe("countSavedHomes: the number on the Saved tab (S6-T03)", () => {
  it("counts through the same inner join as the list, so a home no longer shown is not counted", async () => {
    db.answer = { count: 3, error: null };
    expect(await countSavedHomes()).toBe(3);
    expect(db.asked).toEqual([
      'saved_properties:properties!inner(short_id):{"count":"exact","head":true}',
    ]);
  });

  it("is 0 when the database gives no count", async () => {
    db.answer = { count: null, error: null };
    expect(await countSavedHomes()).toBe(0);
  });

  it("logs the code and throws when the read fails", async () => {
    db.answer = { count: null, error: { code: "XX000" } };
    await expect(countSavedHomes()).rejects.toEqual({ code: "XX000" });
    expect(db.logged).toEqual([["saved homes could not be counted", { errorCode: "XX000" }]]);
  });
});
