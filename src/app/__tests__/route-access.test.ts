import { beforeEach, describe, expect, it, vi } from "vitest";
import { staffLoginPath } from "@/server/auth/staff-sign-in";
import type { SessionView } from "@/server/auth/session";

/**
 * S8-T04 (ADR-125): the six route handlers, called through the real route files, refuse a caller that
 * has no token, a wrong token or no valid code. The handlers' own rules are tested beside them; this
 * proves the route files are wired to those handlers, so a refactor cannot leave a door open. The
 * database and the session are faked, and every call they receive is recorded.
 */
const state = vi.hoisted(() => ({
  cronToken: null as string | null,
  adminCalls: [] as string[],
  calls: [] as string[],
  exchangeError: null as unknown,
  session: null as unknown,
  verifyError: null as { code?: string } | null,
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: path });
  },
}));
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      state.adminCalls.push(`from:${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: state.cronToken === null ? null : { token: state.cronToken },
              error: null,
            }),
          }),
        }),
      };
    },
    rpc: async (name: string) => {
      state.adminCalls.push(`rpc:${name}`);
      return { data: [], error: null };
    },
    storage: {
      from: (bucket: string) => {
        state.adminCalls.push(`storage:${bucket}`);
        return { remove: async () => ({ error: null }) };
      },
    },
  }),
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        state.calls.push(`exchange:${code}`);
        return { error: state.exchangeError };
      },
      verifyOtp: async () => {
        state.calls.push("verifyOtp");
        return { error: state.verifyError };
      },
      signOut: async () => {
        state.calls.push("signOut");
        return { error: null };
      },
    },
  }),
}));
vi.mock("@/server/auth/get-session-view", () => ({
  getSessionView: async () => null,
  loadSessionView: async () => {
    state.calls.push("readSession");
    return state.session;
  },
}));
vi.mock("@/server/audit/audit", () => ({
  writeAudit: async ({ action }: { action: string }) => {
    state.calls.push(`audit:${action}`);
  },
}));

const TOKEN = "route-test-token-not-real-0001";

beforeEach(() => {
  state.cronToken = TOKEN;
  state.adminCalls = [];
  state.calls = [];
  state.exchangeError = null;
  state.session = null;
  state.verifyError = null;
});

const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://findprop.example${path}`, { method: "POST", headers });

describe.each([
  ["crm-retry", "/api/internal/crm-retry", () => import("@/app/api/internal/crm-retry/route")],
  [
    "sweep-media",
    "/api/internal/sweep-media",
    () => import("@/app/api/internal/sweep-media/route"),
  ],
])("UT-route-access: /api/internal/%s answers only to the job's token", (_name, path, load) => {
  it("exports POST only, so every other method is refused by the framework", async () => {
    expect(Object.keys(await load()).sort()).toEqual(["POST"]);
  });

  it.each([
    ["no token", {}],
    ["an empty token", { "x-cron-token": "" }],
    ["a wrong token", { "x-cron-token": "route-test-token-not-real-0002" }],
    ["a token of another length", { "x-cron-token": "short" }],
    ["the token in the wrong header", { authorization: `Bearer ${TOKEN}` }],
    ["a session cookie and no token", { cookie: "sb-access-token=anything" }],
  ])("refuses %s with a plain 401 and touches nothing but the token", async (_what, headers) => {
    const { POST } = await load();
    const response = await POST(post(path, headers));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.adminCalls).toEqual(["from:internal_cron_tokens"]);
  });

  it("refuses everyone when no token has been set", async () => {
    state.cronToken = null;
    const { POST } = await load();
    const response = await POST(post(path, { "x-cron-token": TOKEN }));
    expect(response.status).toBe(401);
    expect(state.adminCalls).toEqual(["from:internal_cron_tokens"]);
  });
});

describe("UT-route-access: /api/internal/sweep-media with the right token (the control)", () => {
  it("is let in, which shows the refusals above are because of the token", async () => {
    const { POST } = await import("@/app/api/internal/sweep-media/route");
    const response = await POST(post("/api/internal/sweep-media", { "x-cron-token": TOKEN }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: 0 });
    expect(state.adminCalls).toEqual(["from:internal_cron_tokens", "rpc:orphan_listing_photos"]);
  });
});

describe("UT-route-access: /api/health is public by design and shows nothing", () => {
  it("exports GET only, reads no request and no database, and answers with no data and no cache", async () => {
    const route = await import("@/app/api/health/route");
    expect(Object.keys(route)).toEqual(["GET"]);
    expect(route.GET.length).toBe(0);
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", app: "findsprop" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(state.adminCalls).toEqual([]);
    expect(state.calls).toEqual([]);
  });
});

const customer: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000c1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

async function callbackDestination(query: string): Promise<string> {
  const { GET } = await import("@/app/auth/callback/route");
  try {
    await GET(new Request(`https://findprop.example/auth/callback${query}`));
  } catch (error) {
    return (error as { redirectTo?: string }).redirectTo ?? "no redirect";
  }
  return "no redirect";
}

describe("UT-route-access: /auth/callback finishes a staff sign-in only with a code and an eligible account", () => {
  it.each([
    ["no area", "?code=one-time-code", staffLoginPath("builder", "error")],
    ["an unknown area", "?code=one-time-code&area=root", staffLoginPath("builder", "error")],
    ["no code", "?area=admin", staffLoginPath("admin", "error")],
    [
      "an error from the provider",
      "?area=admin&error=access_denied",
      staffLoginPath("admin", "cancelled"),
    ],
  ])(
    "sends the visitor back to the sign-in page for %s, without trading a code",
    async (_what, query, expected) => {
      expect(await callbackDestination(query)).toBe(expected);
      expect(state.calls).toEqual([]);
    },
  );

  it("sends the visitor back when the code does not work, and never reads a session", async () => {
    state.exchangeError = { message: "invalid grant" };
    expect(await callbackDestination("?code=bad-code&area=admin")).toBe(
      staffLoginPath("admin", "error"),
    );
    expect(state.calls).toEqual(["exchange:bad-code"]);
  });

  it("signs a customer out and refuses them the admin area, whatever the address says", async () => {
    state.session = customer;
    const destination = await callbackDestination(
      "?code=good-code&area=admin&next=https://evil.example/admin/dashboard",
    );
    expect(destination).toBe(staffLoginPath("admin", "denied"));
    expect(state.calls).toEqual([
      "exchange:good-code",
      "readSession",
      "audit:staff.sign_in_denied",
      "signOut",
    ]);
  });

  it("signs out and sends back a code that gave no session, from the builder area too", async () => {
    state.session = null;
    const destination = await callbackDestination("?code=good-code&area=builder");
    expect(destination).not.toMatch(/dashboard/);
    expect(destination).toMatch(/^\/builder\/login\?/);
    expect(state.calls).toContain("signOut");
  });
});

async function confirmDestination(query: string): Promise<string> {
  const { GET } = await import("@/app/auth/confirm/route");
  try {
    await GET(new Request(`https://findprop.example/auth/confirm${query}`));
  } catch (error) {
    return (error as { redirectTo?: string }).redirectTo ?? "no redirect";
  }
  return "no redirect";
}

describe("UT-route-access: /auth/confirm accepts only a usable single-use token", () => {
  it.each([
    ["no token", "?type=email_change"],
    ["an empty token", "?token_hash=&type=email_change"],
    ["a token with odd characters", "?token_hash=../../etc/passwd&type=email_change"],
    ["a token that is too short", "?token_hash=abc&type=email_change"],
    ["the wrong type", "?token_hash=fake-token-hash-for-tests&type=recovery"],
    ["no type", "?token_hash=fake-token-hash-for-tests"],
  ])(
    "sends the visitor to the expired page for %s, without asking Supabase",
    async (_what, query) => {
      expect(await confirmDestination(query)).toBe("/auth?email=expired");
      expect(state.calls).toEqual([]);
    },
  );

  it("sends the visitor to the expired page when Supabase refuses the token", async () => {
    state.verifyError = { code: "otp_expired" };
    expect(
      await confirmDestination("?token_hash=fake-token-hash-for-tests&type=email_change"),
    ).toBe("/auth?email=expired");
    expect(state.calls).toEqual(["verifyOtp"]);
  });
});
