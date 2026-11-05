import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();
const incoming = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({ headers: async () => incoming.headers }));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: () => ({ rpc }) }));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "test-secret-for-the-unit-tests-only", APP_ENV: "production" },
}));

const { createProjectWriteStore, currentVisitor, verifiedPhoneDigits } = await import("../service");

const VISITOR = "c".repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  incoming.headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.7",
    "user-agent": "TestBrowser/1.0",
  });
});

describe("UT-project-service: the database store (S4-T09 step D)", () => {
  it("calls submit_project_lead with only the values given, and returns the new id", async () => {
    rpc.mockResolvedValue({ data: "lead-uuid", error: null });
    const id = await createProjectWriteStore("req-1").insertLead({
      slug: "kadal-vista",
      kind: "site_visit",
      name: "Priya Raman",
      phone: "919840012345",
      email: null,
      message: null,
      visitDate: "2026-11-20",
      visitor: VISITOR,
    });
    expect(id).toBe("lead-uuid");
    expect(rpc).toHaveBeenCalledWith("submit_project_lead", {
      p_slug: "kadal-vista",
      p_kind: "site_visit",
      p_name: "Priya Raman",
      p_phone: "919840012345",
      p_visitor_hash: VISITOR,
      p_visit_date: "2026-11-20",
    });
  });

  it("sends the email and message when there are some", async () => {
    rpc.mockResolvedValue({ data: "lead-uuid", error: null });
    await createProjectWriteStore("req-1").insertLead({
      slug: "kadal-vista",
      kind: "enquiry",
      name: "Priya Raman",
      phone: "919840012345",
      email: "priya@example.com",
      message: "Hello",
      visitDate: null,
      visitor: VISITOR,
    });
    expect(rpc).toHaveBeenCalledWith(
      "submit_project_lead",
      expect.objectContaining({ p_email: "priya@example.com", p_message: "Hello" }),
    );
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_visit_date");
  });

  it("turns a refusal by the database into the closed error, never the raw message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "project_lead.project_not_found" },
    });
    await expect(
      createProjectWriteStore("req-1").insertLead({
        slug: "gone",
        kind: "enquiry",
        name: "Priya Raman",
        phone: "919840012345",
        email: null,
        message: null,
        visitDate: null,
        visitor: VISITOR,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("calls track_project_event and returns whether it was recorded", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const store = createProjectWriteStore("req-1");
    const row = { slug: "kadal-vista", event: "view", visitor: VISITOR };
    expect(await store.recordEvent(row)).toBe(true);
    expect(await store.recordEvent(row)).toBe(false);
    expect(rpc).toHaveBeenCalledWith("track_project_event", {
      p_slug: "kadal-vista",
      p_event_type: "view",
      p_visitor_hash: VISITOR,
    });
  });

  it("treats a failed or odd answer as an internal error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection" } });
    await expect(
      createProjectWriteStore("req-1").recordEvent({
        slug: "kadal-vista",
        event: "view",
        visitor: VISITOR,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    rpc.mockResolvedValue({ data: "not-a-boolean", error: null });
    await expect(
      createProjectWriteStore("req-1").recordEvent({
        slug: "kadal-vista",
        event: "view",
        visitor: VISITOR,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("UT-project-service: who is calling", () => {
  it("is a 40-character one-way hash of the address and browser, the same for the same caller", async () => {
    const first = await currentVisitor();
    expect(first).toMatch(/^[0-9a-f]{40}$/);
    expect(first).not.toContain("203.0.113.7");
    expect(await currentVisitor()).toBe(first);
  });

  it("is a different hash for a different browser or address", async () => {
    const first = await currentVisitor();
    incoming.headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "user-agent": "OtherBrowser/2.0",
    });
    expect(await currentVisitor()).not.toBe(first);
    incoming.headers = new Headers({
      "x-vercel-forwarded-for": "198.51.100.9",
      "user-agent": "TestBrowser/1.0",
    });
    expect(await currentVisitor()).not.toBe(first);
  });

  it("reads the account's phone from the verified token as digits only", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u", phone: "+91 98400-12345" } },
      error: null,
    });
    expect(await verifiedPhoneDigits()).toBe("919840012345");
  });

  it("refuses when the token has no phone, a phone that is too short, or fails to verify", async () => {
    for (const answer of [
      { data: { claims: { sub: "u" } }, error: null },
      { data: { claims: { sub: "u", phone: "12345" } }, error: null },
      { data: null, error: { message: "bad token" } },
    ]) {
      getClaims.mockResolvedValue(answer);
      await expect(verifiedPhoneDigits()).rejects.toMatchObject({
        code: "FORBIDDEN",
        reason: "PHONE_NOT_VERIFIED",
      });
    }
  });
});
