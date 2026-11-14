import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/server/auth/session";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) as unknown }));
const incomingHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(incomingHeaders) }));
const environment: { RATE_LIMIT_HMAC_SECRET?: string; APP_ENV: string } = {
  RATE_LIMIT_HMAC_SECRET: "a-test-secret-that-is-at-least-32-characters-long",
  APP_ENV: "production",
};
vi.mock("@/server/env", () => ({ env: environment }));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: () => ({}) }));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: () => ({}) }));

const rowsClaimed: unknown[] = [];
vi.mock("@/server/idempotency/idempotency-table", () => ({
  createIdempotencyTable: () => ({
    insertIfAbsent: (row: unknown) => {
      rowsClaimed.push(row);
      return Promise.resolve(true);
    },
    read: () => Promise.resolve(null),
    save: (row: unknown) => {
      rowsClaimed.push(row);
      return Promise.resolve();
    },
    remove: (row: unknown) => {
      rowsClaimed.push(row);
      return Promise.resolve();
    },
  }),
}));

const user: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

async function load() {
  return (await import("@/server/actions/deps")).actionDeps;
}

describe("UT-action-deps: the real dependencies of defineAction", () => {
  beforeEach(() => {
    updateTag.mockReset();
    rowsClaimed.length = 0;
    incomingHeaders.delete("x-request-id");
    incomingHeaders.set("x-vercel-forwarded-for", "203.0.113.7");
    incomingHeaders.set("user-agent", "Mozilla/5.0");
    environment.RATE_LIMIT_HMAC_SECRET = "a-test-secret-that-is-at-least-32-characters-long";
    environment.APP_ENV = "production";
  });

  it("refreshes every named cache tag (Next.js 16 updateTag)", async () => {
    const deps = await load();
    deps.invalidate(["property:1", "listings:home"]);
    expect(updateTag.mock.calls).toEqual([["property:1"], ["listings:home"]]);
  });

  it("uses the request id the proxy gave the request, or makes one", async () => {
    const deps = await load();
    incomingHeaders.set("x-request-id", "req-12345678");
    expect(await deps.newRequestId()).toBe("req-12345678");
    incomingHeaders.set("x-request-id", "bad id");
    expect(await deps.newRequestId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("claims a key for the signed-in user by user id, under a scope the table accepts (lowercase and underscores)", async () => {
    const deps = await load();
    await deps.beginIdempotent({
      scope: "createListing",
      key: "key-1",
      session: user,
      requestId: "req-12345678",
    });
    expect(rowsClaimed).toEqual([{ scope: "create_listing", subject: "user-1", key: "key-1" }]);
  });

  it("claims a key for an anonymous caller by visitor hash, never by address", async () => {
    const deps = await load();
    await deps.beginIdempotent({
      scope: "submitForm",
      key: "key-1",
      session: null,
      requestId: "req-12345678",
    });
    const claimed = rowsClaimed[0] as { subject: string };
    expect(claimed.subject).toMatch(/^[0-9a-f]{40}$/);
    expect(JSON.stringify(rowsClaimed)).not.toContain("203.0.113.7");
  });

  it("stores and gives back a claim under the same subject as it was made", async () => {
    const deps = await load();
    const request = {
      scope: "createListing",
      key: "key-1",
      session: user,
      requestId: "req-12345678",
    };
    await deps.beginIdempotent(request);
    await deps.completeIdempotent({ ...request, result: { ok: true } });
    await deps.releaseIdempotent(request);
    const subjects = new Set((rowsClaimed as { subject: string }[]).map((row) => row.subject));
    expect([...subjects]).toEqual(["user-1"]);
  });

  it("refuses an anonymous claim when the hash secret is missing", async () => {
    delete environment.RATE_LIMIT_HMAC_SECRET;
    const deps = await load();
    await expect(
      deps.beginIdempotent({
        scope: "submitForm",
        key: "key-1",
        session: null,
        requestId: "req-12345678",
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
