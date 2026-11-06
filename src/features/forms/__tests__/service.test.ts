import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  form: { data: null as unknown, error: null as null | { code?: string; message?: string } },
  asked: [] as string[],
}));
const incoming = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => incoming.headers }));
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "unit-test-fake-secret", APP_ENV: "production" },
}));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: () => ({ rpc: db.rpc }) }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({
    from: (table: string) => ({
      select: (columns: string) => {
        db.asked.push(`${table}:${columns}`);
        const chain = {
          eq: (column: string, value: unknown) => {
            db.asked.push(`${column}=${String(value)}`);
            return chain;
          },
          maybeSingle: async () => db.form,
        };
        return chain;
      },
    }),
  }),
}));

const { createFormWriteStore, currentVisitor } = await import("../service");

const ROW = {
  formSlug: "contact",
  visitor: "c".repeat(40),
  submission: { name: "Priya Raman", mobile: "919840012345", email: null, data: { message: "Hi" } },
  source: "/contact",
  projectSlug: null,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.form = { data: null, error: null };
  db.asked = [];
  incoming.headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.7",
    "user-agent": "TestBrowser/1.0",
  });
});

describe("UT-forms-service: the database store (S5-T05)", () => {
  it("reads only an active form, by its slug, with the columns a visitor may see", async () => {
    db.form = { data: { slug: "contact" }, error: null };
    const result = await createFormWriteStore("req-1").readForm("contact");
    expect(result).toEqual({ row: { slug: "contact" }, found: true });
    expect(db.asked.join(" ")).toContain("forms:slug, name, kind, placement, project_id");
    expect(db.asked).toContain("slug=contact");
    expect(db.asked).toContain("active=true");
    expect(db.asked.join(" ")).not.toContain("crm");
  });

  it("says a form is not found when the database shows none", async () => {
    expect(await createFormWriteStore("req-1").readForm("nope")).toEqual({
      row: null,
      found: false,
    });
  });

  it("turns a failed read into a safe error", async () => {
    db.form = { data: null, error: { code: "57014", message: "boom" } };
    await expect(createFormWriteStore("req-1").readForm("contact")).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("calls record_form_submission with only the values given, and returns the id", async () => {
    db.rpc.mockResolvedValue({ data: "submission-uuid", error: null });
    expect(await createFormWriteStore("req-1").insertSubmission(ROW)).toBe("submission-uuid");
    expect(db.rpc).toHaveBeenCalledWith("record_form_submission", {
      p_form_slug: "contact",
      p_visitor_hash: "c".repeat(40),
      p_data: { message: "Hi" },
      p_idempotency_key: "00000000-0000-4000-8000-000000000001",
      p_name: "Priya Raman",
      p_mobile: "919840012345",
      p_source: "/contact",
    });
  });

  it("names the project page, and the email, when there are some", async () => {
    db.rpc.mockResolvedValue({ data: "submission-uuid", error: null });
    await createFormWriteStore("req-1").insertSubmission({
      ...ROW,
      projectSlug: "kadal-vista",
      submission: { ...ROW.submission, email: "priya@example.com" },
    });
    expect(db.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_project_slug: "kadal-vista",
      p_email: "priya@example.com",
    });
  });

  it("turns a database refusal into the closed set of action errors", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "form.not_found" } });
    await expect(createFormWriteStore("req-1").insertSubmission(ROW)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    db.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "x" } });
    await expect(createFormWriteStore("req-1").insertSubmission(ROW)).rejects.toMatchObject({
      code: "INTERNAL",
    });
    db.rpc.mockResolvedValue({ data: 42, error: null });
    await expect(createFormWriteStore("req-1").insertSubmission(ROW)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});

describe("currentVisitor: who is sending (BR-75)", () => {
  it("is a 40 character one-way hash that does not contain the address", async () => {
    const visitor = await currentVisitor();
    expect(visitor).toMatch(/^[0-9a-f]{40}$/);
    expect(visitor).not.toContain("203");
  });

  it("is the same for the same caller, and differs for another", async () => {
    const first = await currentVisitor();
    expect(await currentVisitor()).toBe(first);
    incoming.headers = new Headers({
      "x-vercel-forwarded-for": "198.51.100.9",
      "user-agent": "TestBrowser/1.0",
    });
    expect(await currentVisitor()).not.toBe(first);
  });
});
