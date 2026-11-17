import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rpc: { data: null as unknown, error: null as null | { code?: string; message?: string } },
  current: { data: null as unknown, error: null as null | { code: string } },
  asked: [] as { name: string; args?: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: async () => ({}) }));

const client = {
  rpc: (name: string, args?: unknown) => {
    db.asked.push({ name, args });
    // `my_properties` is read with a select; `set_listing_location` answers at once.
    const answer = Promise.resolve(db.rpc);
    return Object.assign(answer, {
      select: () => ({ eq: () => ({ maybeSingle: async () => db.current }) }),
    });
  },
};

const { listingLocationStore } = await import("../location-store");
const store = () =>
  listingLocationStore(client as unknown as Parameters<typeof listingLocationStore>[0]);

const LISTING = "00000000-0000-4000-9000-000000000001";

beforeEach(() => {
  db.rpc = { data: null, error: null };
  db.current = { data: null, error: null };
  db.asked = [];
});

describe("UT-listing-location-store: set_listing_location as the signed-in owner (ADR-141)", () => {
  it("calls the function with the listing and the point, longitude after latitude by name, and returns the state", async () => {
    db.rpc = { data: "pending", error: null };
    expect(await store().setLocation(LISTING, 12.5, 80.25)).toBe("pending");
    expect(db.asked).toEqual([
      { name: "set_listing_location", args: { p_property_id: LISTING, p_lat: 12.5, p_lng: 80.25 } },
    ]);
  });

  it("maps what the database raises, and keeps the point out of the error", async () => {
    db.rpc = { data: null, error: { code: "22023", message: "listing.location_out_of_region" } };
    let failure: { code: string; message: string } | undefined;
    try {
      await store().setLocation(LISTING, 12.345678, 80.876543);
    } catch (error) {
      failure = error as { code: string; message: string };
    }
    expect(failure).toMatchObject({ code: "VALIDATION" });
    expect(JSON.stringify(failure)).not.toMatch(/12\.345678|80\.876543/);
    expect(failure?.message).not.toMatch(/12\.345678|80\.876543/);
  });

  it("treats an answer that is not a state as a failure", async () => {
    db.rpc = { data: null, error: null };
    await expect(store().setLocation(LISTING, 12.5, 80.25)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("finds the caller's own listing through my_properties, and nothing for someone else's", async () => {
    db.current = { data: { short_id: "abcd2345", status: "approved" }, error: null };
    expect(await store().current(LISTING)).toEqual({ shortId: "abcd2345", status: "approved" });
    db.current = { data: null, error: null };
    expect(await store().current(LISTING)).toBeNull();
    expect(db.asked.map((ask) => ask.name)).toEqual(["my_properties", "my_properties"]);
  });
});
