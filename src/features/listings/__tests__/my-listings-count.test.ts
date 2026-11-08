import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  answer: { count: 0 as number | null, error: null as null | { code: string } },
  asked: [] as string[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/media", () => ({ PHOTO_BUCKET: "listing-photos" }));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
}));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: async () => null }));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => db.logged.push(args) },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: (name: string, args: unknown, options: unknown) => ({
      neq: async (column: string, value: string) => {
        db.asked.push(
          `${name}:${JSON.stringify(args)}:${JSON.stringify(options)}:${column}:${value}`,
        );
        return db.answer;
      },
    }),
  }),
}));

const { countMyListings } = await import("../queries");

beforeEach(() => {
  db.answer = { count: 0, error: null };
  db.asked = [];
  db.logged = [];
});

describe("countMyListings: the number on the My listings tab (S6-T03)", () => {
  it("asks the database to count the owner's own listings that are not drafts", async () => {
    db.answer = { count: 5, error: null };
    expect(await countMyListings()).toBe(5);
    expect(db.asked).toEqual([
      'my_properties:undefined:{"count":"exact","head":true}:status:draft',
    ]);
  });

  it("is 0 when the database gives no count", async () => {
    db.answer = { count: null, error: null };
    expect(await countMyListings()).toBe(0);
  });

  it("logs the code, not the details, and throws when the read fails", async () => {
    db.answer = { count: null, error: { code: "XX000" } };
    await expect(countMyListings()).rejects.toEqual({ code: "XX000" });
    expect(db.logged).toEqual([["my listings could not be counted", { errorCode: "XX000" }]]);
  });
});
