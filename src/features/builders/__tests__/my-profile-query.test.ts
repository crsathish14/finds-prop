import { beforeEach, describe, expect, it, vi } from "vitest";

type Answer = { data: unknown; count?: number | null; error: null | { code: string } };

const db = vi.hoisted(() => ({
  answers: {} as Record<string, Answer>,
  calls: [] as string[],
  tables: [] as string[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => db.logged.push(args) },
}));
vi.mock("@/server/supabase/server", () => {
  // A small stand-in for the query builder: it records each step and answers by the function asked.
  const chain = (name: string) => {
    const query = {
      select: (columns: string, options?: unknown) => {
        db.calls.push(`${name}.select(${columns}${options ? `, ${JSON.stringify(options)}` : ""})`);
        return query;
      },
      eq: (column: string, value: unknown) => {
        db.calls.push(`${name}.eq(${column}, ${String(value)})`);
        return query;
      },
      then: (resolve: (answer: Answer) => unknown) =>
        resolve(db.answers[name] ?? { data: [], error: null }),
    };
    return query;
  };
  return {
    createServerSupabase: async () => ({
      rpc: (name: string, _args?: unknown, options?: unknown) => {
        db.calls.push(`${name}(${options ? JSON.stringify(options) : ""})`);
        return chain(name);
      },
      from: (table: string) => {
        db.tables.push(table);
        return chain(table);
      },
    }),
  };
});

const { getMyProfile } = await import("../queries");

const builder = {
  id: "b1",
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
  contact_person: "Meena Raj",
  phone: null,
  logo_url: null,
  website: null,
  description: null,
  tagline: null,
  established_year: null,
  projects_delivered: null,
  logo_path: null,
};

beforeEach(() => {
  db.answers = {};
  db.calls = [];
  db.tables = [];
  db.logged = [];
});

describe("UT-builder-my-profile: the builder's own profile read (S7-T03)", () => {
  it("counts the live projects through my_projects(), never the projects table, whose moderation columns are hidden", async () => {
    db.answers = {
      my_builder: { data: [builder], error: null },
      my_projects: { data: null, count: 2, error: null },
    };
    const profile = await getMyProfile();
    expect(profile).toMatchObject({ name: "Kadal Homes", liveProjects: 2 });
    expect(db.tables).toEqual([]);
    expect(db.calls).toContain('my_projects({"count":"exact","head":true})');
    expect(db.calls).toContain("my_projects.eq(moderation, approved)");
    expect(db.calls).toContain("my_projects.eq(published, true)");
  });

  it("is nothing when the caller has no active builder record", async () => {
    db.answers = { my_builder: { data: [], error: null } };
    await expect(getMyProfile()).resolves.toBeNull();
    expect(db.calls.some((call) => call.startsWith("my_projects"))).toBe(false);
  });

  it("throws a failed count, logging only its code", async () => {
    db.answers = {
      my_builder: { data: [builder], error: null },
      my_projects: { data: null, error: { code: "42501" } },
    };
    await expect(getMyProfile()).rejects.toMatchObject({ code: "42501" });
    expect(db.logged).toEqual([
      ["the builder's project count could not be read", { errorCode: "42501" }],
    ]);
  });
});
