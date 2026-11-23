import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  answer: {
    data: [] as { id: string; status: string }[],
    count: 0 as number | null,
    error: null as null | { code: string },
  },
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
    rpc: (name: string, args: unknown, options: unknown) => {
      db.asked.push(`rpc:${name}:${JSON.stringify(args)}:${JSON.stringify(options)}`);
      return {
        select: (columns: string) => {
          db.asked.push(`select:${columns}`);
          return {
            in: (column: string, values: string[]) => {
              db.asked.push(`in:${column}:${values.join(",")}`);
              return {
                is: (isColumn: string, value: null) => {
                  db.asked.push(`is:${isColumn}:${String(value)}`);
                  return {
                    order: (by: string, direction: { ascending: boolean }) => {
                      db.asked.push(`order:${by}:${direction.ascending}`);
                      return {
                        limit: async (limit: number) => (
                          db.asked.push(`limit:${limit}`),
                          db.answer
                        ),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

const { getListingsWithoutLocation, MY_LISTINGS_LIMIT } = await import("../queries");

beforeEach(() => {
  db.answer = { data: [], count: 0, error: null };
  db.asked = [];
  db.logged = [];
});

describe("getListingsWithoutLocation: the listings the location prompt is about (plan PR 7c)", () => {
  it("asks for the owner's listings in review or Live with no place, newest first, and never reads the point", async () => {
    await getListingsWithoutLocation();
    expect(db.asked).toEqual([
      'rpc:my_properties:undefined:{"count":"exact"}',
      "select:id, status, created_at",
      "in:status:pending,approved",
      "is:location:null",
      "order:created_at:false",
      `limit:${MY_LISTINGS_LIMIT}`,
    ]);
  });

  it("is none when every listing holds a place", async () => {
    expect(await getListingsWithoutLocation()).toEqual({
      count: 0,
      firstId: null,
      anyLive: false,
    });
  });

  it("counts them all, points at the newest and says whether one of them is Live", async () => {
    db.answer = {
      data: [
        { id: "newest", status: "pending" },
        { id: "older", status: "approved" },
      ],
      count: 2,
      error: null,
    };
    expect(await getListingsWithoutLocation()).toEqual({
      count: 2,
      firstId: "newest",
      anyLive: true,
    });
  });

  it("says no listing is Live when all of them are in review", async () => {
    db.answer = { data: [{ id: "only", status: "pending" }], count: 1, error: null };
    expect((await getListingsWithoutLocation()).anyLive).toBe(false);
  });

  it("uses the database's count when more were found than are read", async () => {
    db.answer = { data: [{ id: "newest", status: "approved" }], count: 340, error: null };
    expect((await getListingsWithoutLocation()).count).toBe(340);
  });

  it("falls back to the rows read when the database gives no count", async () => {
    db.answer = { data: [{ id: "one", status: "approved" }], count: null, error: null };
    expect((await getListingsWithoutLocation()).count).toBe(1);
  });

  it("logs the code, not the details, and throws when the read fails", async () => {
    db.answer = { data: [], count: null, error: { code: "XX000" } };
    await expect(getListingsWithoutLocation()).rejects.toEqual({ code: "XX000" });
    expect(db.logged).toEqual([
      ["listings without a location could not be read", { errorCode: "XX000" }],
    ]);
  });
});
