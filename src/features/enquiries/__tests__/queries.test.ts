import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  claims: { data: { claims: { phone: "919840012345" } }, error: null } as {
    data: { claims: Record<string, unknown> } | null;
    error: unknown;
  },
  rows: { data: [] as unknown[], error: null as null | { code: string } },
  summary: { fullName: "Priya Raman", email: "priya@example.test" } as {
    fullName: string | null;
    email: string | null;
  },
  asked: [] as { table: string; select: string; column: string; value: string }[],
}));
const errors = vi.hoisted(() => ({ calls: [] as unknown[][] }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ getAccountSummary: async () => db.summary }));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => errors.calls.push(args) },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getClaims: async () => db.claims },
    from: (table: string) => ({
      select: (select: string) => ({
        eq: (column: string, value: string) => {
          db.asked.push({ table, select, column, value });
          return { order: () => ({ limit: async () => db.rows }) };
        },
      }),
    }),
  }),
}));

const { getEnquiryContact, getSentEnquiries } = await import("../queries");

beforeEach(() => {
  db.claims = { data: { claims: { phone: "919840012345" } }, error: null };
  db.rows = { data: [], error: null };
  db.summary = { fullName: "Priya Raman", email: "priya@example.test" };
  db.asked = [];
  errors.calls = [];
});

describe("getEnquiryContact: what the enquiry form starts with (S5-T03)", () => {
  it("is the account's name, the sign-in number as digits and the verified email", async () => {
    expect(await getEnquiryContact("user-1")).toEqual({
      name: "Priya Raman",
      phone: "919840012345",
      email: "priya@example.test",
    });
  });

  it("reads the number from a token that carries a plus sign", async () => {
    db.claims = { data: { claims: { phone: "+91 98400 12345" } }, error: null };
    expect((await getEnquiryContact("user-1")).phone).toBe("919840012345");
  });

  it("starts empty where the account has nothing, so the visitor types it", async () => {
    db.summary = { fullName: null, email: null };
    db.claims = { data: { claims: {} }, error: null };
    expect(await getEnquiryContact("user-1")).toEqual({ name: "", phone: "", email: "" });
  });

  it("leaves out a number that is not 6 to 15 digits", async () => {
    db.claims = { data: { claims: { phone: "12" } }, error: null };
    expect((await getEnquiryContact("user-1")).phone).toBe("");
  });
});

describe("getSentEnquiries: the enquiries the visitor sent", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: "enquiry-1",
    created_at: "2026-11-06T10:00:00Z",
    status: "new",
    message: "Is it available?",
    properties: { short_id: "k3x9a2bd", slug: "sea-view-2-bhk", title: "Sea view 2 BHK" },
    ...overrides,
  });

  it("asks for the visitor's own rows by name, since an owner can also read enquiries on their homes", async () => {
    await getSentEnquiries("user-1");
    expect(db.asked).toEqual([
      expect.objectContaining({ table: "enquiries", column: "user_id", value: "user-1" }),
    ]);
  });

  it("gives each enquiry with the home's address, and the time of the read", async () => {
    db.rows = { data: [row()], error: null };
    const { enquiries, now } = await getSentEnquiries("user-1");
    expect(enquiries).toEqual([
      {
        id: "enquiry-1",
        sentAt: "2026-11-06T10:00:00Z",
        status: "new",
        message: "Is it available?",
        home: { href: "/properties/sea-view-2-bhk-k3x9a2bd", title: "Sea view 2 BHK" },
      },
    ]);
    expect(now).toBeGreaterThan(0);
  });

  it("keeps an enquiry whose home is no longer shown, with no home", async () => {
    db.rows = { data: [row({ properties: null })], error: null };
    expect((await getSentEnquiries("user-1")).enquiries[0]?.home).toBeNull();
  });

  it("skips a row that does not fit the shape", async () => {
    db.rows = { data: [row({ status: "archived" }), row({ id: "enquiry-2" })], error: null };
    expect((await getSentEnquiries("user-1")).enquiries.map((enquiry) => enquiry.id)).toEqual([
      "enquiry-2",
    ]);
  });

  it("throws on a failed read and logs only the code", async () => {
    db.rows = { data: [], error: { code: "57014" } };
    await expect(getSentEnquiries("user-1")).rejects.toMatchObject({ code: "57014" });
    expect(JSON.stringify(errors.calls)).toContain("57014");
  });
});
