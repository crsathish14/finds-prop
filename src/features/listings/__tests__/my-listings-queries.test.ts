import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  listings: { data: [] as unknown[], error: null as null | { code: string } },
  photos: { data: [] as unknown[], error: null as null | { code: string } },
  asked: [] as string[],
  logged: [] as unknown[][],
  closeAnswer: { data: null as unknown, error: null as null | { code: string; message: string } },
  deleteAnswer: { data: [] as { short_id: string }[], error: null as null | { code: string } },
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

const client = {
  rpc: (name: string, args?: unknown) => {
    db.asked.push(`rpc:${name}:${JSON.stringify(args ?? {})}`);
    if (name === "close_listing") return Promise.resolve(db.closeAnswer);
    return {
      select: (columns: string) => {
        db.asked.push(`select:${columns.slice(0, 20)}`);
        return {
          neq: (column: string, value: string) => {
            db.asked.push(`neq:${column}:${value}`);
            return {
              order: (by: string, options: { ascending: boolean }) => {
                db.asked.push(`order:${by}:${options.ascending}`);
                return {
                  limit: async (count: number) => (db.asked.push(`limit:${count}`), db.listings),
                };
              },
            };
          },
        };
      },
    };
  },
  from: (table: string) => ({
    select: () => ({
      in: (column: string, ids: string[]) => {
        db.asked.push(`in:${table}:${column}:${ids.join(",")}`);
        return { order: async () => db.photos };
      },
    }),
    delete: () => ({
      eq: (column: string, value: string) => ({
        select: async () => {
          db.asked.push(`delete:${table}:${column}:${value}`);
          return db.deleteAnswer;
        },
      }),
    }),
  }),
};
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: async () => client }));

const { getMyListings, MY_LISTINGS_LIMIT } = await import("../queries");
const { myListingsStore } = await import("../my-listings-store");

const listing = (id: string) => ({
  id,
  short_id: "abcd2345",
  slug: "flat",
  status: "approved",
  listing_type: "sale",
  property_type: "apartment",
  title: "Flat",
  price: 100,
  locality: "Adyar",
  rejection_reason: null,
  created_at: "2026-11-05T10:00:00+00:00",
});

beforeEach(() => {
  db.listings = { data: [], error: null };
  db.photos = { data: [], error: null };
  db.asked = [];
  db.logged = [];
  db.closeAnswer = { data: null, error: null };
  db.deleteAnswer = { data: [], error: null };
});

describe("UT-my-listings-queries: the owner's listings (S6-T03)", () => {
  it("asks for the caller's own rows outside the drafts, newest first, then for their photos", async () => {
    db.listings = { data: [listing("l1"), listing("l2")], error: null };
    db.photos = {
      data: [{ listing_id: "l2", storage_path: "u/l2/a.jpg", position: 0 }],
      error: null,
    };
    const { listings, now } = await getMyListings();
    expect(now).toBeGreaterThan(0);
    expect(db.asked).toContain("rpc:my_properties:{}");
    expect(db.asked).toContain("neq:status:draft");
    expect(db.asked).toContain("order:created_at:false");
    expect(db.asked).toContain(`limit:${MY_LISTINGS_LIMIT}`);
    expect(db.asked).toContain("in:listing_media:listing_id:l1,l2");
    expect(listings.map((item) => item.id)).toEqual(["l1", "l2"]);
    expect(listings[1]?.coverUrl).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/listing-photos/u/l2/a.jpg",
    );
  });

  it("does not ask for photos when there are no listings", async () => {
    expect((await getMyListings()).listings).toEqual([]);
    expect(db.asked.some((entry) => entry.startsWith("in:listing_media"))).toBe(false);
  });

  it("throws a failed read, logging only its code", async () => {
    db.listings = { data: [], error: { code: "XX000" } };
    await expect(getMyListings()).rejects.toMatchObject({ code: "XX000" });
    expect(JSON.stringify(db.logged)).toContain("errorCode");
    db.listings = { data: [listing("l1")], error: null };
    db.photos = { data: [], error: { code: "XX001" } };
    await expect(getMyListings()).rejects.toMatchObject({ code: "XX001" });
  });
});

describe("UT-my-listings-store: the owner's calls to the database (S6-T03)", () => {
  const store = () => myListingsStore(client as unknown as Parameters<typeof myListingsStore>[0]);

  it("closes through close_listing with the listing and the outcome", async () => {
    db.closeAnswer = {
      data: [{ id: "l1", short_id: "abcd2345", status: "sold" }],
      error: null,
    };
    expect(await store().close("l1", "sold")).toEqual({
      listingId: "l1",
      shortId: "abcd2345",
      status: "sold",
    });
    expect(db.asked).toContain('rpc:close_listing:{"p_listing":"l1","p_outcome":"sold"}');
  });

  it("turns the database's refusal into an action error", async () => {
    db.closeAnswer = { data: null, error: { code: "55000", message: "listing.not_closable" } };
    await expect(store().close("l1", "sold")).rejects.toMatchObject({ code: "CONFLICT" });
    db.closeAnswer = { data: [], error: null };
    await expect(store().close("l1", "sold")).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("deletes and returns the short id, or null when nothing was deleted", async () => {
    db.deleteAnswer = { data: [{ short_id: "abcd2345" }], error: null };
    expect(await store().remove("l1")).toBe("abcd2345");
    expect(db.asked).toContain("delete:properties:id:l1");
    db.deleteAnswer = { data: [], error: null };
    expect(await store().remove("l1")).toBeNull();
  });

  it("turns a failed delete into an action error", async () => {
    db.deleteAnswer = { data: [], error: { code: "42501" } };
    await expect(store().remove("l1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
