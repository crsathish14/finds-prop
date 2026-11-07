import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  answer: { data: [] as unknown[] | null, error: null as null | { code: string } },
  calls: [] as { name: string; args: unknown }[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
}));
vi.mock("@/server/logger", () => ({
  logger: {
    error: (...args: unknown[]) => db.logged.push(["error", ...args]),
    warn: (...args: unknown[]) => db.logged.push(["warn", ...args]),
  },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: async (name: string, args: unknown) => {
      db.calls.push({ name, args });
      return db.answer;
    },
  }),
}));

const { getQueueCounts, getQueueLocalities, getQueuePage } = await import("../queries");
const { encodeCursor } = await import("../cursor");

const listing = (number: number) => ({
  id: `00000000-0000-4000-9000-${String(number).padStart(12, "0")}`,
  short_id: `abcd23${String(number).padStart(2, "0")}`,
  status: "pending",
  featured: false,
  listing_type: "sale",
  property_type: "apartment",
  title: `Home ${number}`,
  description: null,
  bhk: 2,
  bathrooms: 1,
  area_sqft: 900,
  price: 5000000,
  furnishing: null,
  amenities: [],
  address: "1 Road",
  locality: "Adyar",
  city: "Chennai",
  pincode: "600020",
  rejection_reason: null,
  submitted_at: `2026-11-07T10:00:${String(60 - number).padStart(2, "0")}+00:00`,
  owner_name: null,
  owner_email: null,
  photos: [],
});

beforeEach(() => {
  db.answer = { data: [], error: null };
  db.calls = [];
  db.logged = [];
});

describe("UT-moderation-queries: the admin's reads (S6-T04)", () => {
  it("asks for one more row than a page, with only the filters that are set", async () => {
    await getQueuePage({ tab: "pending" });
    expect(db.calls).toEqual([
      { name: "admin_listing_queue", args: { p_tab: "pending", p_limit: 26 } },
    ]);
  });

  it("passes the locality, the kind and the cursor", async () => {
    const after = encodeCursor({
      submittedAt: "2026-11-07T10:00:00+00:00",
      id: "00000000-0000-4000-9000-000000000009",
    });
    await getQueuePage({ tab: "all", locality: "Adyar", kind: "rent", after });
    expect(db.calls[0]?.args).toEqual({
      p_tab: "all",
      p_limit: 26,
      p_locality: "Adyar",
      p_kind: "rent",
      p_after_at: "2026-11-07T10:00:00+00:00",
      p_after_id: "00000000-0000-4000-9000-000000000009",
    });
  });

  it("ignores a cursor it did not make", async () => {
    await getQueuePage({ tab: "pending", after: "garbage" });
    expect(db.calls[0]?.args).toEqual({ p_tab: "pending", p_limit: 26 });
  });

  it("returns a short page with no next cursor", async () => {
    db.answer = { data: [listing(1), listing(2)], error: null };
    const page = await getQueuePage({ tab: "pending" });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("trims the extra row and makes the cursor from the last row shown", async () => {
    db.answer = { data: Array.from({ length: 26 }, (_, index) => listing(index + 1)), error: null };
    const page = await getQueuePage({ tab: "pending" });
    expect(page.items).toHaveLength(25);
    const last = page.items.at(-1);
    if (!last) throw new Error("expected rows");
    expect(page.nextCursor).toBe(encodeCursor(last));
  });

  it("logs the rows it could not read, and shows the rest", async () => {
    db.answer = { data: [listing(1), { nope: true }], error: null };
    const page = await getQueuePage({ tab: "pending" });
    expect(page.items).toHaveLength(1);
    expect(page.skipped).toBe(1);
    expect(db.logged).toEqual([
      ["warn", "admin listing queue rows could not be read", { skipped: 1 }],
    ]);
  });

  it("throws a failed read, and logs only its code", async () => {
    db.answer = { data: null, error: { code: "42501" } };
    await expect(getQueuePage({ tab: "pending" })).rejects.toMatchObject({ code: "42501" });
    await expect(getQueueCounts()).rejects.toMatchObject({ code: "42501" });
    await expect(getQueueLocalities()).rejects.toMatchObject({ code: "42501" });
    expect(db.logged.every((entry) => JSON.stringify(entry).includes("errorCode"))).toBe(true);
  });

  it("reads the counts and the localities", async () => {
    db.answer = {
      data: [{ pending: 1, approved: 2, rejected: 3, closed: 4, total: 10 }],
      error: null,
    };
    expect(await getQueueCounts()).toEqual({
      pending: 1,
      approved: 2,
      rejected: 3,
      closed: 4,
      total: 10,
    });
    db.answer = { data: ["Adyar", "Velachery"], error: null };
    expect(await getQueueLocalities()).toEqual(["Adyar", "Velachery"]);
  });
});
