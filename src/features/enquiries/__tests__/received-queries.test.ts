import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  own: { data: [] as { id: string }[], error: null as null | { code: string } },
  rows: { data: [] as unknown[], error: null as null | { code: string } },
  update: { data: [] as { id: string }[], error: null as null | { code: string; message: string } },
  asked: [] as string[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ getAccountSummary: async () => ({}) }));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => db.logged.push(args) },
}));

const client = {
  rpc: (name: string) => ({
    select: (columns: string) => ({
      neq: (column: string, value: string) => ({
        limit: async (count: number) => {
          db.asked.push(`rpc:${name}:${columns}:${column}:${value}:${count}`);
          return db.own;
        },
      }),
    }),
  }),
  from: (table: string) => ({
    select: (columns: string) => ({
      in: (column: string, ids: string[]) => {
        db.asked.push(`from:${table}:${columns.slice(0, 22)}:${column}:${ids.join(",")}`);
        return {
          order: (by: string, options: { ascending: boolean }) => {
            db.asked.push(`order:${by}:${options.ascending}`);
            return { limit: async () => db.rows };
          },
        };
      },
    }),
    update: (values: { status: string }) => ({
      eq: (column: string, value: string) => ({
        select: async () => {
          db.asked.push(`update:${table}:${values.status}:${column}:${value}`);
          return db.update;
        },
      }),
    }),
  }),
};
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: async () => client }));

const { getReceivedEnquiries, RECEIVED_LIMIT } = await import("../queries");
const { enquiryStatusStore } = await import("../status-store");

const row = (extra: Record<string, unknown> = {}) => ({
  id: "e1",
  created_at: "2026-11-07T10:00:00+00:00",
  status: "new",
  name: "Arjun Menon",
  phone: "9841055512",
  email: "arjun@example.test",
  message: "Is it still available?",
  properties: {
    short_id: "abcd2345",
    slug: "flat-in-adyar",
    title: "Flat in Adyar",
    status: "approved",
  },
  ...extra,
});

beforeEach(() => {
  db.own = { data: [], error: null };
  db.rows = { data: [], error: null };
  db.update = { data: [], error: null };
  db.asked = [];
  db.logged = [];
});

describe("UT-received-enquiries: the owner's received list (S6-T03)", () => {
  it("asks first for the caller's own listings outside the drafts, then only for enquiries on those", async () => {
    db.own = { data: [{ id: "l1" }, { id: "l2" }], error: null };
    db.rows = { data: [row()], error: null };
    const { enquiries } = await getReceivedEnquiries();
    expect(db.asked[0]).toContain("rpc:my_properties:id:status:draft:");
    expect(db.asked).toContain("from:enquiries:id, created_at, status:property_id:l1,l2");
    expect(db.asked).toContain("order:created_at:false");
    expect(RECEIVED_LIMIT).toBe(60);
    expect(enquiries).toEqual([
      {
        id: "e1",
        receivedAt: "2026-11-07T10:00:00+00:00",
        status: "new",
        name: "Arjun Menon",
        phone: "9841055512",
        email: "arjun@example.test",
        message: "Is it still available?",
        home: { title: "Flat in Adyar", href: "/properties/flat-in-adyar-abcd2345" },
      },
    ]);
  });

  it("reads no enquiries, and asks for none, when the owner has no listing", async () => {
    const { enquiries } = await getReceivedEnquiries();
    expect(enquiries).toEqual([]);
    expect(db.asked.some((entry) => entry.startsWith("from:enquiries"))).toBe(false);
  });

  it("gives no address for a home that is not Live any more", async () => {
    db.own = { data: [{ id: "l1" }], error: null };
    db.rows = {
      data: [
        row({
          properties: { short_id: "abcd2345", slug: "flat", title: "Flat", status: "sold" },
        }),
      ],
      error: null,
    };
    const { enquiries } = await getReceivedEnquiries();
    expect(enquiries[0]?.home).toEqual({ title: "Flat", href: null });
  });

  it("keeps an enquiry whose home cannot be read, and leaves out a row that is not an enquiry", async () => {
    db.own = { data: [{ id: "l1" }], error: null };
    db.rows = { data: [row({ properties: null }), { id: 1 }, null], error: null };
    const { enquiries } = await getReceivedEnquiries();
    expect(enquiries).toHaveLength(1);
    expect(enquiries[0]?.home).toBeNull();
  });

  it("throws a failed read, logging only its code", async () => {
    db.own = { data: [], error: { code: "XX000" } };
    await expect(getReceivedEnquiries()).rejects.toMatchObject({ code: "XX000" });
    db.own = { data: [{ id: "l1" }], error: null };
    db.rows = { data: [], error: { code: "XX001" } };
    await expect(getReceivedEnquiries()).rejects.toMatchObject({ code: "XX001" });
    expect(db.logged.every((entry) => JSON.stringify(entry).includes("errorCode"))).toBe(true);
  });
});

describe("UT-enquiry-status-store: the owner's update (S6-T03)", () => {
  const store = () =>
    enquiryStatusStore(client as unknown as Parameters<typeof enquiryStatusStore>[0]);

  it("updates only the status of that enquiry and says whether a row changed", async () => {
    db.update = { data: [{ id: "e1" }], error: null };
    expect(await store().setStatus("e1", "contacted")).toBe(true);
    expect(db.asked).toContain("update:enquiries:contacted:id:e1");
    db.update = { data: [], error: null };
    expect(await store().setStatus("e1", "contacted")).toBe(false);
  });

  it("turns the guard's refusal and other failures into action errors", async () => {
    db.update = { data: [], error: { code: "P0001", message: "enquiries.status_transition" } };
    await expect(store().setStatus("e1", "contacted")).rejects.toMatchObject({ code: "CONFLICT" });
    db.update = { data: [], error: { code: "42501", message: "denied" } };
    await expect(store().setStatus("e1", "closed")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
