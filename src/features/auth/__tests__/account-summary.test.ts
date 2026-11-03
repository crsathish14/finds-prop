import type * as ReactModule from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  claims: { data: { claims: { sub: "user-1", email: "priya@example.com" } }, error: null } as {
    data: { claims: Record<string, unknown> } | null;
    error: unknown;
  },
  profile: { data: { full_name: "Priya Raman" }, error: null } as {
    data: { full_name: string | null } | null;
    error: { code: string } | null;
  },
  profileQueries: [] as { table: string; column: string; value: string }[],
}));
const warnings = vi.hoisted(() => ({ calls: [] as unknown[][] }));

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  cache: <Callback>(callback: Callback) => callback,
}));
vi.mock("@/server/logger", () => ({
  logger: { warn: (...args: unknown[]) => warnings.calls.push(args) },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getClaims: async () => supabase.claims },
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          supabase.profileQueries.push({ table, column, value });
          return { maybeSingle: async () => supabase.profile };
        },
      }),
    }),
  }),
}));

const { getAccountSummary } = await import("../account-summary");

beforeEach(() => {
  supabase.claims = {
    data: { claims: { sub: "user-1", email: "priya@example.com" } },
    error: null,
  };
  supabase.profile = { data: { full_name: "Priya Raman" }, error: null };
  supabase.profileQueries = [];
  warnings.calls = [];
});

describe("getAccountSummary: what the account menu shows about the signed-in person", () => {
  it("gives the name from their own profile row and the email from the verified token", async () => {
    expect(await getAccountSummary("user-1")).toEqual({
      fullName: "Priya Raman",
      email: "priya@example.com",
    });
    expect(supabase.profileQueries).toEqual([{ table: "profiles", column: "id", value: "user-1" }]);
  });

  it("has no name when the person skipped that step, and no email when there is none", async () => {
    supabase.profile = { data: { full_name: null }, error: null };
    supabase.claims = { data: { claims: { sub: "user-1" } }, error: null };
    expect(await getAccountSummary("user-1")).toEqual({ fullName: null, email: null });
  });

  it("has no name when the person has no profile row", async () => {
    supabase.profile = { data: null, error: null };
    expect((await getAccountSummary("user-1")).fullName).toBeNull();
  });

  it("shows no name when the read fails, and logs the error code but not the person", async () => {
    supabase.profile = { data: null, error: { code: "XX000" } };
    expect(await getAccountSummary("user-1")).toEqual({
      fullName: null,
      email: "priya@example.com",
    });
    expect(warnings.calls).toHaveLength(1);
    expect(JSON.stringify(warnings.calls)).toContain("XX000");
    expect(JSON.stringify(warnings.calls)).not.toContain("user-1");
    expect(JSON.stringify(warnings.calls)).not.toContain("priya");
  });

  it("shows no email when the token cannot be verified", async () => {
    supabase.claims = { data: null, error: { message: "bad token" } };
    expect((await getAccountSummary("user-1")).email).toBeNull();
  });
});
