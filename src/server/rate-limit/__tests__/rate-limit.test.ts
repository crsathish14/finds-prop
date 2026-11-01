import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/server/auth/session";

const rpc = vi.fn();
const createAdminSupabase = vi.fn();
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: (requestId?: string) => createAdminSupabase(requestId) as unknown,
}));
const incomingHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(incomingHeaders) }));
const environment: { RATE_LIMIT_HMAC_SECRET?: string; APP_ENV: string } = {
  RATE_LIMIT_HMAC_SECRET: "a-test-secret-that-is-at-least-32-characters-long",
  APP_ENV: "production",
};
vi.mock("@/server/env", () => ({ env: environment }));

const user: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

async function load() {
  return await import("@/server/rate-limit/rate-limit");
}

describe("UT-rate-limit: the database counter", () => {
  beforeEach(() => {
    rpc.mockReset();
    createAdminSupabase.mockReset().mockReturnValue({ rpc });
  });

  it("asks rate_limit_hit and maps its answer", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 42 }], error: null });
    const { createRateLimitCounter } = await load();
    const answer = await createRateLimitCounter("req-12345678").hit(
      "enquiry_user",
      "user-1",
      86400,
      10,
    );
    expect(createAdminSupabase).toHaveBeenCalledWith("req-12345678");
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", {
      limit_scope: "enquiry_user",
      limit_subject: "user-1",
      window_seconds: 86400,
      max_hits: 10,
    });
    expect(answer).toEqual({ allowed: false, retryAfter: 42 });
  });

  it("fails closed when the database errors or does not answer", async () => {
    const { createRateLimitCounter } = await load();
    const counter = createRateLimitCounter("req-12345678");
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(counter.hit("a_b", "subject-1", 60, 1)).rejects.toMatchObject({
      code: "INTERNAL",
    });
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(counter.hit("a_b", "subject-1", 60, 1)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});

describe("UT-rate-limit: enforceActionRateLimit", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });
    createAdminSupabase.mockReset().mockReturnValue({ rpc });
    incomingHeaders.set("x-vercel-forwarded-for", "203.0.113.7");
    incomingHeaders.set("user-agent", "Mozilla/5.0");
    environment.RATE_LIMIT_HMAC_SECRET = "a-test-secret-that-is-at-least-32-characters-long";
    environment.APP_ENV = "production";
  });

  it("counts a signed-in user by id, without needing the secret", async () => {
    delete environment.RATE_LIMIT_HMAC_SECRET;
    const { enforceActionRateLimit } = await load();
    await enforceActionRateLimit({ scope: "enquiry", session: user, requestId: "req-12345678" });
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", {
      limit_scope: "enquiry_user",
      limit_subject: "user-1",
      window_seconds: 86400,
      max_hits: 10,
    });
  });

  it("counts an anonymous caller by a hash that holds neither the address nor the browser", async () => {
    const { enforceActionRateLimit } = await load();
    await enforceActionRateLimit({
      scope: "project_lead",
      session: null,
      requestId: "req-12345678",
    });
    const args = rpc.mock.calls[0]?.[1] as { limit_subject: string; limit_scope: string };
    expect(args.limit_scope).toBe("project_lead_visitor");
    expect(args.limit_subject).toMatch(/^[0-9a-f]{40}$/);
    expect(JSON.stringify(args)).not.toContain("203.0.113.7");
    expect(JSON.stringify(args)).not.toContain("Mozilla");
  });

  it("counts a phone by a hash of the phone, never the phone itself", async () => {
    const { enforceActionRateLimit } = await load();
    await enforceActionRateLimit({
      scope: "otp_verify",
      session: null,
      key: "+919000000001",
      requestId: "req-12345678",
    });
    const args = rpc.mock.calls[0]?.[1] as { limit_subject: string };
    expect(args.limit_subject).toMatch(/^[0-9a-f]{40}$/);
    expect(args.limit_subject).not.toContain("9190");
  });

  it("refuses an anonymous call when the secret is missing, instead of counting nobody", async () => {
    delete environment.RATE_LIMIT_HMAC_SECRET;
    const { enforceActionRateLimit } = await load();
    await expect(
      enforceActionRateLimit({ scope: "places", session: null, requestId: "req-12345678" }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats every caller as local, ignoring proxy headers, when running locally", async () => {
    environment.APP_ENV = "local";
    const { enforceActionRateLimit } = await load();
    await enforceActionRateLimit({ scope: "places", session: null, requestId: "req-12345678" });
    const first = (rpc.mock.calls[0]?.[1] as { limit_subject: string }).limit_subject;
    incomingHeaders.set("x-vercel-forwarded-for", "198.51.100.99");
    await enforceActionRateLimit({ scope: "places", session: null, requestId: "req-12345678" });
    expect((rpc.mock.calls[1]?.[1] as { limit_subject: string }).limit_subject).toBe(first);
  });

  it("raises RATE_LIMITED with the retry time when the counter says no", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 90 }], error: null });
    const { enforceActionRateLimit } = await load();
    await expect(
      enforceActionRateLimit({ scope: "enquiry", session: user, requestId: "req-12345678" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfter: 90 });
  });
});
