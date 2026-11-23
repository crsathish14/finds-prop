import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  session: { userId: "00000000-0000-4000-8000-0000000000a1" } as { userId: string } | null,
  row: {
    data: { contact_email: "owner@example.test" } as unknown,
    error: null as null | { code: string },
  },
  asked: [] as string[],
  warnings: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/media", () => ({ PHOTO_BUCKET: "listing-photos" }));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: async () => db.session }));
vi.mock("@/server/logger", () => ({
  logger: { warn: (...args: unknown[]) => db.warnings.push(args), error: vi.fn() },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          db.asked.push(`${table}:${columns}:${column}:${value}`);
          return { maybeSingle: async () => db.row };
        },
      }),
    }),
  }),
}));

const { getMyContactEmail } = await import("../queries");

beforeEach(() => {
  db.session = { userId: "00000000-0000-4000-8000-0000000000a1" };
  db.row = { data: { contact_email: "owner@example.test" }, error: null };
  db.asked = [];
  db.warnings = [];
});

describe("UT-getMyContactEmail: the private email for enquiries (ADR-186)", () => {
  it("reads only that column of the signed-in person's own row", async () => {
    expect(await getMyContactEmail()).toBe("owner@example.test");
    expect(db.asked).toEqual(["profiles:contact_email:id:00000000-0000-4000-8000-0000000000a1"]);
  });

  it("answers nothing for a visitor and reads nothing", async () => {
    db.session = null;
    expect(await getMyContactEmail()).toBeNull();
    expect(db.asked).toEqual([]);
  });

  it("answers nothing when none is saved", async () => {
    db.row = { data: { contact_email: null }, error: null };
    expect(await getMyContactEmail()).toBeNull();
    db.row = { data: null, error: null };
    expect(await getMyContactEmail()).toBeNull();
  });

  it("answers nothing when the read fails, and logs only the error code, never an address", async () => {
    db.row = { data: { contact_email: "owner@example.test" }, error: { code: "XX000" } };
    expect(await getMyContactEmail()).toBeNull();
    expect(JSON.stringify(db.warnings)).toContain("XX000");
    expect(JSON.stringify(db.warnings)).not.toContain("owner@example.test");
  });
});
