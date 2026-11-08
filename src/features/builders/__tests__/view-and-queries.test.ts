import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  answer: { data: [] as unknown[], error: null as null | { code: string } },
  asked: [] as string[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => db.logged.push(args) },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: async (name: string) => {
      db.asked.push(name);
      return db.answer;
    },
  }),
}));

const { getBuilderOverview } = await import("../queries");
const { statusOf, toBuilderRows } = await import("../view");

const row = (extra: Record<string, unknown> = {}) => ({
  active: true,
  contact_person: "Meena Raj",
  description: null,
  email: "sales@kadalhomes.example",
  id: "b1",
  invited_at: "2026-11-05T10:00:00+00:00",
  kind: "builder",
  last_sign_in_at: "2026-11-08T09:40:00+00:00",
  leads: 148,
  logo_url: null,
  name: "Kadal Homes",
  phone: null,
  projects: 4,
  website: "https://kadalhomes.example",
  ...extra,
});

beforeEach(() => {
  db.answer = { data: [], error: null };
  db.asked = [];
  db.logged = [];
});

describe("UT-builder-view: the rows of the Builders table (S7-T05)", () => {
  it("is Inactive when deactivated, Invited when never signed in, and Active otherwise", () => {
    expect(statusOf({ active: false, last_sign_in_at: "2026-11-08T09:40:00+00:00" })).toBe(
      "inactive",
    );
    expect(statusOf({ active: false, last_sign_in_at: null })).toBe("inactive");
    expect(statusOf({ active: true, last_sign_in_at: null })).toBe("invited");
    expect(statusOf({ active: true, last_sign_in_at: "2026-11-08T09:40:00+00:00" })).toBe("active");
  });

  it("maps a row with its status, counts and details", () => {
    expect(toBuilderRows([row()])).toEqual([
      {
        id: "b1",
        name: "Kadal Homes",
        email: "sales@kadalhomes.example",
        kind: "builder",
        status: "active",
        contactPerson: "Meena Raj",
        phone: null,
        logoUrl: null,
        website: "https://kadalhomes.example",
        description: null,
        projects: 4,
        leads: 148,
        invitedAt: "2026-11-05T10:00:00+00:00",
        lastSignInAt: "2026-11-08T09:40:00+00:00",
      },
    ]);
  });

  it("keeps the order the database gave, reads an unknown type as a builder, and leaves out a row that is not shaped as one", () => {
    const rows = toBuilderRows([
      row({ id: "b2", name: "Nila Habitats", kind: "agent", last_sign_in_at: null }),
      { id: 3 },
      row({ id: "b3", kind: "something" }),
    ]);
    expect(rows.map((item) => item.id)).toEqual(["b2", "b3"]);
    expect(rows[0]?.kind).toBe("agent");
    expect(rows[0]?.status).toBe("invited");
    expect(rows[1]?.kind).toBe("builder");
  });
});

describe("UT-builder-queries: the admin's list of builders (S7-T05)", () => {
  it("asks for admin_builder_overview and maps what comes back", async () => {
    db.answer = { data: [row()], error: null };
    const rows = await getBuilderOverview();
    expect(db.asked).toEqual(["admin_builder_overview"]);
    expect(rows.map((item) => item.name)).toEqual(["Kadal Homes"]);
  });

  it("throws a failed read, logging only its code", async () => {
    db.answer = { data: [], error: { code: "42501" } };
    await expect(getBuilderOverview()).rejects.toMatchObject({ code: "42501" });
    expect(db.logged).toEqual([["the builders could not be read", { errorCode: "42501" }]]);
  });
});
