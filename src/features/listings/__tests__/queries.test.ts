import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  draft: { data: null as unknown, error: null as null | { code: string } },
  photos: { data: [] as unknown[], error: null as null | { code: string } },
  list: { data: [] as unknown[], error: null as null | { code: string } },
  asked: [] as string[],
}));
const errors = vi.hoisted(() => ({ calls: [] as unknown[][] }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => errors.calls.push(args) },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: (name: string) => ({
      select: (columns: string) => {
        db.asked.push(`rpc:${name}:${columns.slice(0, 20)}`);
        return {
          eq: (column: string, value: string) => {
            db.asked.push(`eq:${column}:${value}`);
            return {
              maybeSingle: async () => db.draft,
              order: () => ({ limit: async () => db.list }),
            };
          },
        };
      },
    }),
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          db.asked.push(`from:${table}:${column}:${value}`);
          return { order: async () => db.photos };
        },
      }),
    }),
  }),
}));

const { getMyDraft, listMyDrafts } = await import("../queries");

const ID = "00000000-0000-4000-9000-000000000001";
const draftRow = {
  id: ID,
  short_id: "abcd2345",
  status: "draft",
  listing_type: "sale",
  property_type: "apartment",
  address: null,
  locality: "Adyar",
  city: null,
  pincode: null,
  bhk: null,
  bathrooms: null,
  area_sqft: null,
  price: null,
  furnishing: null,
  amenities: [],
  title: null,
  description: null,
  updated_at: "2026-11-07T10:00:00Z",
};

beforeEach(() => {
  db.draft = { data: draftRow, error: null };
  db.photos = { data: [{ id: "p1", storage_path: "u/l/a.jpg", position: 0 }], error: null };
  db.list = { data: [], error: null };
  db.asked = [];
  errors.calls = [];
});

describe("UT-listings-queries: reading the owner's drafts (S6-T02)", () => {
  it("reads the draft through my_properties and its photos by listing", async () => {
    const view = await getMyDraft(ID);
    expect(view?.locality).toBe("Adyar");
    expect(view?.photos).toEqual([{ id: "p1", path: "u/l/a.jpg", position: 0 }]);
    expect(db.asked.some((ask) => ask.startsWith("rpc:my_properties"))).toBe(true);
    expect(db.asked).toContain(`eq:id:${ID}`);
    expect(db.asked).toContain(`from:listing_media:listing_id:${ID}`);
  });

  it("answers null for a listing that is not the caller's or does not exist, and reads no photos", async () => {
    db.draft = { data: null, error: null };
    expect(await getMyDraft(ID)).toBeNull();
    expect(db.asked.some((ask) => ask.startsWith("from:listing_media"))).toBe(false);
  });

  it("throws when a read fails, and logs only the error code", async () => {
    db.draft = { data: null, error: { code: "XX000" } };
    await expect(getMyDraft(ID)).rejects.toMatchObject({ code: "XX000" });
    db.draft = { data: draftRow, error: null };
    db.photos = { data: [], error: { code: "XX001" } };
    await expect(getMyDraft(ID)).rejects.toMatchObject({ code: "XX001" });
    expect(JSON.stringify(errors.calls)).not.toContain("Adyar");
  });

  it("lists the drafts, only the ones that are shaped as a listing", async () => {
    db.list = {
      data: [
        {
          id: "a",
          title: "Sea view",
          locality: null,
          property_type: null,
          listing_type: null,
          updated_at: "t",
        },
        { id: 1 },
      ],
      error: null,
    };
    expect((await listMyDrafts()).map((draft) => draft.id)).toEqual(["a"]);
    db.list = { data: [], error: { code: "XX002" } };
    await expect(listMyDrafts()).rejects.toMatchObject({ code: "XX002" });
  });
});
