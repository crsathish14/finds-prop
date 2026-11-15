import { beforeEach, describe, expect, it, vi } from "vitest";

// UT-ai-own-home (ADR-128 section 5.3, R-BE-03): the read behind `propose_enquiry`'s "the caller does not own
// the home". It asks the database for the caller's own homes, as the caller, with the home's public id only.
// The database is a stand-in here.

type Answer = { data: { id: string }[] | null; error: { code: string } | null };

const answer: { current: Answer } = { current: { data: [], error: null } };
const calls: { rpc: string; columns: string; filter: [string, string]; limit: number }[] = [];
const error = vi.fn();

const client = {
  rpc: (name: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: string) => ({
        limit: (limit: number): Promise<Answer> => {
          calls.push({ rpc: name, columns, filter: [column, value], limit });
          return Promise.resolve(answer.current);
        },
      }),
    }),
  }),
};

vi.mock("@/server/supabase/server", () => ({ createServerSupabase: async () => client }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({}) }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/features/search", () => ({ LISTINGS_TAG: "home-listings" }));
vi.mock("@/features/projects", () => ({ PROJECTS_TAG: "projects", PROJECT_STATUSES: [] }));

const { ownsHome } = await import("../queries");

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  answer.current = { data: [], error: null };
});

describe("UT-ai-own-home: whether the caller owns a home", () => {
  it("asks for the caller's own homes by the home's public id and nothing else, one row at most", async () => {
    await ownsHome("k3x9a2bd");
    expect(calls).toEqual([
      { rpc: "my_properties", columns: "id", filter: ["short_id", "k3x9a2bd"], limit: 1 },
    ]);
  });

  it("is true when the database lists the home among the caller's own", async () => {
    answer.current = { data: [{ id: "6f1d8a52-0c3e-4b7a-9d21-5e8f4c2a7b10" }], error: null };
    expect(await ownsHome("k3x9a2bd")).toBe(true);
  });

  it("is false when it does not: another owner's home, or no home, or no caller", async () => {
    expect(await ownsHome("k3x9a2bd")).toBe(false);
  });

  it("throws when the read fails, so a failed check never looks like 'does not own it'", async () => {
    answer.current = { data: null, error: { code: "57014" } };
    await expect(ownsHome("k3x9a2bd")).rejects.toThrow("could not be read");
    expect(error).toHaveBeenCalledExactlyOnceWith("the caller's own homes could not be read", {
      errorCode: "57014",
    });
  });
});
