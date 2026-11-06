import type * as ReactModule from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: {
    data: { user: { email: "", email_confirmed_at: null, new_email: undefined } },
    error: null,
  } as {
    data: { user: Record<string, unknown> | null };
    error: { code?: string } | null;
  },
  thrown: null as unknown,
  session: { userId: "user-1" } as { userId: string } | null,
  summary: { fullName: "Priya Raman" } as { fullName: string | null },
}));
const warnings = vi.hoisted(() => ({ calls: [] as unknown[][] }));

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  cache: <Callback>(callback: Callback) => callback,
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "prerender") throw error;
  },
}));
vi.mock("@/server/logger", () => ({
  logger: { warn: (...args: unknown[]) => warnings.calls.push(args) },
}));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: async () => auth.session }));
vi.mock("@/features/auth", () => ({ getAccountSummary: async () => auth.summary }));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => {
        if (auth.thrown) throw auth.thrown;
        return auth.user;
      },
    },
  }),
}));

const { getDashboardPerson, getEmailState } = await import("../queries");

beforeEach(() => {
  auth.user = {
    data: { user: { email: "", email_confirmed_at: null, new_email: undefined } },
    error: null,
  };
  auth.thrown = null;
  auth.session = { userId: "user-1" };
  auth.summary = { fullName: "Priya Raman" };
  warnings.calls = [];
});

describe("getEmailState: reads the account's email as the visitor (S5-T04)", () => {
  it("is none for an account with no address", async () => {
    expect(await getEmailState()).toEqual({ kind: "none" });
  });

  it("is pending when Supabase Auth holds an address a link was sent to", async () => {
    auth.user = {
      data: { user: { email: "", email_confirmed_at: null, new_email: "priya@example.com" } },
      error: null,
    };
    expect(await getEmailState()).toEqual({ kind: "pending", email: "priya@example.com" });
  });

  it("is verified for a confirmed address", async () => {
    auth.user = {
      data: {
        user: {
          email: "priya@example.com",
          email_confirmed_at: "2026-11-03T10:00:00Z",
          new_email: undefined,
        },
      },
      error: null,
    };
    expect(await getEmailState()).toEqual({ kind: "verified", email: "priya@example.com" });
  });

  it("is unknown when Auth answers with an error, and logs the code but not an address", async () => {
    auth.user = { data: { user: null }, error: { code: "session_expired" } };
    expect(await getEmailState()).toEqual({ kind: "unknown" });
    expect(JSON.stringify(warnings.calls)).toContain("session_expired");
    expect(JSON.stringify(warnings.calls)).not.toContain("@");
  });

  it("is unknown when the call throws, so the dashboard shows no prompt", async () => {
    auth.thrown = new Error("network down");
    expect(await getEmailState()).toEqual({ kind: "unknown" });
    expect(warnings.calls).toHaveLength(1);
  });

  it("lets Next.js's own signal through instead of logging it", async () => {
    auth.thrown = new Error("prerender");
    await expect(getEmailState()).rejects.toThrow("prerender");
    expect(warnings.calls).toHaveLength(0);
  });
});

describe("getDashboardPerson: who the dashboard greets", () => {
  it("is the name the person gave", async () => {
    expect(await getDashboardPerson()).toEqual({ name: "Priya Raman" });
  });

  it("has no name when the person skipped that step", async () => {
    auth.summary = { fullName: null };
    expect(await getDashboardPerson()).toEqual({ name: null });
  });

  it("is null when nobody is signed in", async () => {
    auth.session = null;
    expect(await getDashboardPerson()).toBeNull();
  });
});
