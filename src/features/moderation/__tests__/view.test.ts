import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../cursor";
import { countForTab, EMPTY_COUNTS, toCounts, toLocalities, toQueueItems } from "../view";

const SUPABASE = "http://127.0.0.1:54321";
const ID = "00000000-0000-4000-9000-000000000001";

const row = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  short_id: "abcd2345",
  status: "pending",
  featured: false,
  listing_type: "sale",
  property_type: "apartment",
  title: "3 BHK in Adyar",
  description: "A bright flat.",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1200,
  price: 8500000,
  furnishing: "semi",
  amenities: ["Gym", "Lift"],
  address: "12 Beach Road",
  locality: "Adyar",
  city: "Chennai",
  pincode: "600020",
  rejection_reason: null,
  submitted_at: "2026-11-07T10:00:00.123456+00:00",
  owner_name: "Priya Raman",
  owner_email: "priya@example.test",
  photos: [
    { id: "p2", path: "u1/l1/two file.jpg", position: 1 },
    { id: "p1", path: "u1/l1/one.jpg", position: 0 },
  ],
  ...extra,
});

describe("UT-moderation-view: queue rows as view models (S6-T04)", () => {
  it("maps a row, with its photos in order and an address for each file", () => {
    const { items, skipped } = toQueueItems([row()], SUPABASE);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: ID,
      shortId: "abcd2345",
      status: "pending",
      listingType: "sale",
      price: 8500000,
      ownerName: "Priya Raman",
      ownerEmail: "priya@example.test",
      rejectionReason: null,
      amenities: ["Gym", "Lift"],
    });
    expect(items[0]?.photos.map((photo) => photo.id)).toEqual(["p1", "p2"]);
    expect(items[0]?.photos[0]?.url).toBe(
      `${SUPABASE}/storage/v1/object/public/listing-photos/u1/l1/one.jpg`,
    );
    expect(items[0]?.photos[1]?.url).toContain("two%20file.jpg");
  });

  it("keeps a listing with no owner name, no email and no photos", () => {
    const { items } = toQueueItems(
      [row({ owner_name: null, owner_email: null, photos: [], amenities: null })],
      SUPABASE,
    );
    expect(items[0]).toMatchObject({
      ownerName: null,
      ownerEmail: null,
      photos: [],
      amenities: [],
    });
  });

  it("reads a listing kind it does not know as none", () => {
    const { items } = toQueueItems([row({ listing_type: "lease" })], SUPABASE);
    expect(items[0]?.listingType).toBeNull();
  });

  it("leaves out a row that is not shaped as a listing, and counts it", () => {
    const { items, skipped } = toQueueItems(
      [row(), { id: 1 }, row({ status: "draft" }), null],
      SUPABASE,
    );
    expect(items).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it("ignores a photos value that is not a list, and photo entries that are not photos", () => {
    expect(toQueueItems([row({ photos: "nope" })], SUPABASE).items[0]?.photos).toEqual([]);
    expect(toQueueItems([row({ photos: [{ id: 1 }] })], SUPABASE).items[0]?.photos).toEqual([]);
  });
});

describe("UT-moderation-view: counts and localities", () => {
  it("reads the counts row", () => {
    const counts = { pending: 3, approved: 5, rejected: 1, closed: 2, total: 11 };
    expect(toCounts([counts])).toEqual(counts);
  });

  it("reads zeros when the answer is not counts", () => {
    expect(toCounts(null)).toEqual(EMPTY_COUNTS);
    expect(toCounts([])).toEqual(EMPTY_COUNTS);
    expect(toCounts([{ pending: "3" }])).toEqual(EMPTY_COUNTS);
  });

  it("gives each tab its own number, and the total to All", () => {
    const counts = { pending: 3, approved: 5, rejected: 1, closed: 2, total: 11 };
    expect(countForTab(counts, "pending")).toBe(3);
    expect(countForTab(counts, "closed")).toBe(2);
    expect(countForTab(counts, "all")).toBe(11);
  });

  it("keeps only real localities", () => {
    expect(toLocalities(["Adyar", "", "  ", 3, "Velachery"])).toEqual(["Adyar", "Velachery"]);
    expect(toLocalities(null)).toEqual([]);
  });
});

describe("UT-moderation-cursor: the page cursor", () => {
  const last = { submittedAt: "2026-11-07T10:00:00.123456+00:00", id: ID };

  it("round-trips the submission time and id exactly", () => {
    expect(decodeCursor(encodeCursor(last))).toEqual({ at: last.submittedAt, id: ID });
  });

  it("is safe in an address", () => {
    expect(encodeCursor(last)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    undefined,
    "",
    "not-base64!",
    Buffer.from("[]").toString("base64url"),
    Buffer.from('["x","y"]').toString("base64url"),
    Buffer.from("{").toString("base64url"),
  ])("ignores %j", (cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });
});
