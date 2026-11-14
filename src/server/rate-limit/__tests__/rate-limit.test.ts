import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/server/auth/session";

const rpc = vi.fn();
const createAdminSupabase = vi.fn();
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: (requestId?: string) => createAdminSupabase(requestId) as unknown,
}));
const incomingHeaders = new Headers();
const cookieValues = new Map<string, string>();
const cookieSettings: { options: unknown[]; failToSet: boolean } = {
  options: [],
  failToSet: false,
};
const cookieJar = {
  get: (name: string) => {
    const value = cookieValues.get(name);
    return value === undefined ? undefined : { value };
  },
  set: (name: string, value: string, options: unknown) => {
    if (cookieSettings.failToSet)
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    cookieValues.set(name, value);
    cookieSettings.options.push(options);
  },
};
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(incomingHeaders),
  cookies: () => Promise.resolve(cookieJar),
}));
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

describe("UT-rate-limit-ai: enforceAiChatRateLimits", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });
    createAdminSupabase.mockReset().mockReturnValue({ rpc });
    incomingHeaders.set("x-vercel-forwarded-for", "2001:db8:abcd:12::1");
    incomingHeaders.set("user-agent", "Mozilla/5.0");
    environment.RATE_LIMIT_HMAC_SECRET = "a-test-secret-that-is-at-least-32-characters-long";
    environment.APP_ENV = "production";
    cookieValues.clear();
    cookieSettings.options = [];
    cookieSettings.failToSet = false;
  });

  function counted() {
    return rpc.mock.calls.map((call) => call[1] as { limit_scope: string; limit_subject: string });
  }

  it("UT-ai-wrapper-anonymous: counts burst, trial, address and global in that order, by a cookie hash and never the cookie itself", async () => {
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    expect(counted().map((entry) => entry.limit_scope)).toEqual([
      "ai_chat_burst_cookie",
      "ai_chat_trial_cookie",
      "ai_chat_trial_ip_network",
      "ai_chat_global_day_global",
    ]);
    const cookie = cookieValues.get("fp_ai_anon");
    expect(cookie).toMatch(/^[A-Za-z0-9_-]{43}$/);
    for (const entry of counted()) {
      expect(entry.limit_subject).toMatch(/^[0-9a-f]{40}$/);
      expect(JSON.stringify(entry)).not.toContain(cookie);
      expect(JSON.stringify(entry)).not.toContain("2001");
    }
  });

  it("UT-ai-wrapper-cookie-set: sets the cookie once, HttpOnly, SameSite Lax and Secure in production", async () => {
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    expect(cookieSettings.options).toHaveLength(1);
    expect(cookieSettings.options[0]).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });

  it("UT-ai-wrapper-cookie-not-secure-locally: leaves Secure off when running locally over http", async () => {
    environment.APP_ENV = "local";
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    expect(cookieSettings.options[0]).toMatchObject({ httpOnly: true, secure: false });
  });

  it("UT-ai-wrapper-same-browser: the same cookie is the same trial on the next message", async () => {
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    const trial = counted().filter((entry) => entry.limit_scope === "ai_chat_trial_cookie");
    expect(trial).toHaveLength(2);
    expect(trial[0]?.limit_subject).toBe(trial[1]?.limit_subject);
  });

  it("UT-ai-wrapper-two-browsers-one-address: tells two browsers apart and groups them in the address cap", async () => {
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    cookieValues.clear();
    incomingHeaders.set("x-vercel-forwarded-for", "2001:db8:abcd:12:9:9:9:9");
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    const entries = counted();
    const subjectsOf = (scope: string) =>
      entries.filter((entry) => entry.limit_scope === scope).map((entry) => entry.limit_subject);
    const trials = subjectsOf("ai_chat_trial_cookie");
    expect(trials[0]).not.toBe(trials[1]);
    const networks = subjectsOf("ai_chat_trial_ip_network");
    expect(networks[0]).toBe(networks[1]);
  });

  it("UT-ai-wrapper-signed-in: counts by user id, sets no cookie and skips the anonymous limits", async () => {
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: user, requestId: "req-12345678" });
    expect(counted().map((entry) => [entry.limit_scope, entry.limit_subject.length])).toEqual([
      ["ai_chat_burst_user", "user-1".length],
      ["ai_chat_user_day_user", "user-1".length],
      ["ai_chat_global_day_global", 40],
    ]);
    expect(cookieValues.size).toBe(0);
  });

  it("UT-ai-wrapper-no-cookie-fallback: counts by the visitor hash when the cookie cannot be set, never by a throwaway id", async () => {
    cookieSettings.failToSet = true;
    const { enforceAiChatRateLimits } = await load();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    expect(counted().map((entry) => entry.limit_scope)).toEqual([
      "ai_chat_burst_visitor",
      "ai_chat_trial_visitor",
      "ai_chat_trial_ip_network",
      "ai_chat_global_day_global",
    ]);
    const first = counted()[1]?.limit_subject;
    rpc.mockClear();
    await enforceAiChatRateLimits({ session: null, requestId: "req-12345678" });
    expect(counted()[1]?.limit_subject).toBe(first);
  });

  it("UT-ai-wrapper-refused: raises RATE_LIMITED and stops counting at the first limit that is used up", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 45 }], error: null });
    const { enforceAiChatRateLimits } = await load();
    await expect(
      enforceAiChatRateLimits({ session: null, requestId: "req-12345678" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfter: 45 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("UT-ai-wrapper-fail-closed: refuses when the counter errors, and when the secret is missing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { enforceAiChatRateLimits } = await load();
    await expect(
      enforceAiChatRateLimits({ session: null, requestId: "req-12345678" }),
    ).rejects.toMatchObject({ code: "INTERNAL" });

    rpc.mockReset();
    delete environment.RATE_LIMIT_HMAC_SECRET;
    await expect(
      enforceAiChatRateLimits({ session: null, requestId: "req-12345678" }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
