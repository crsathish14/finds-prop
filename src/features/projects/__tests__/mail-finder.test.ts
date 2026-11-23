import { beforeEach, describe, expect, it, vi } from "vitest";

const reads: Array<{ table: string; columns: string; column: string; value: string }> = [];
const answers = new Map<string, { data: unknown; error: unknown }>();
const from = (table: string) => ({
  select: (columns: string) => ({
    eq: (column: string, value: string) => ({
      maybeSingle: () => {
        reads.push({ table, columns, column, value });
        return Promise.resolve(answers.get(table) ?? { data: null, error: null });
      },
    }),
  }),
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: () => ({ from }) }));
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "unit-test-fake-secret", APP_ENV: "production" },
}));

const { createLeadMailFinder } = await import("../service");

const LEAD = {
  name: "Priya Raman",
  email: "priya@example.test",
  projects: {
    name: "Kadal Vista",
    slug: "kadal-vista",
    builder_id: "builder-1",
    builders: { email: "sales@builder.example.test" },
  },
};
const EVENT = { kind: "project_lead.received", leadId: "lead-1" } as const;

beforeEach(() => {
  reads.length = 0;
  answers.clear();
});

describe("UT-lead-mail-finder: what the mail reads about a lead (ADR-188)", () => {
  it("finds the visitor, the project and the builder's email by the lead's id", async () => {
    answers.set("project_leads", { data: LEAD, error: null });
    expect(await createLeadMailFinder("req-1")(EVENT)).toEqual({
      posterId: "builder-1",
      posterEmail: "sales@builder.example.test",
      enquirerName: "Priya Raman",
      enquirerEmail: "priya@example.test",
      title: "Kadal Vista",
      pagePath: "/projects/kadal-vista",
      dashboardPath: "/builder/leads",
    });
    expect(reads).toEqual([
      {
        table: "project_leads",
        columns: "name, email, projects(name, slug, builder_id, builders(email))",
        column: "id",
        value: "lead-1",
      },
    ]);
  });

  it("never selects the phone, the message or the visit date of the lead", async () => {
    answers.set("project_leads", { data: LEAD, error: null });
    await createLeadMailFinder("req-1")(EVENT);
    for (const read of reads) {
      expect(read.columns).not.toMatch(/phone|message|visit|\*/u);
    }
  });

  it("answers nothing for another kind of event, and for a lead or project that is gone", async () => {
    const find = createLeadMailFinder("req-1");
    expect(await find({ kind: "enquiry.received", enquiryId: "e1" })).toBeNull();
    expect(reads).toEqual([]);
    answers.set("project_leads", { data: null, error: null });
    expect(await find(EVENT)).toBeNull();
    answers.set("project_leads", { data: { ...LEAD, projects: null }, error: null });
    expect(await find(EVENT)).toBeNull();
  });

  it("answers no poster address when the builder row is not readable, and throws when the read fails", async () => {
    const find = createLeadMailFinder("req-1");
    answers.set("project_leads", {
      data: { ...LEAD, projects: { ...LEAD.projects, builders: null } },
      error: null,
    });
    expect(await find(EVENT)).toMatchObject({ posterEmail: null });
    answers.set("project_leads", { data: null, error: { code: "XX000", message: "x" } });
    await expect(find(EVENT)).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
