import { beforeEach, describe, expect, it, vi } from "vitest";

const reads: Array<{ table: string; columns: string; column: string; value: string }> = [];
const calls: Array<{ name: string; args: unknown }> = [];
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
const rpc = (name: string, args: unknown) => {
  calls.push({ name, args });
  return Promise.resolve(answers.get(name) ?? { data: null, error: null });
};

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: () => ({ from, rpc }),
}));

const { createEnquiryMailFinder } = await import("../service");

const HOME = {
  name: "Priya Raman",
  email: "priya@example.test",
  properties: {
    title: "2 BHK apartment in Adyar",
    slug: "two-bhk-adyar",
    short_id: "k3x9a2bd",
    owner_id: "owner-1",
  },
};
const EVENT = { kind: "enquiry.received", enquiryId: "enquiry-1" } as const;

beforeEach(() => {
  reads.length = 0;
  calls.length = 0;
  answers.clear();
});

describe("UT-enquiry-mail-finder: what the mail reads about an enquiry (ADR-188, ADR-198)", () => {
  it("finds the enquirer, the home and the poster's address by the enquiry's id", async () => {
    answers.set("enquiries", { data: HOME, error: null });
    answers.set("poster_mail_address", { data: "owner@example.test", error: null });
    expect(await createEnquiryMailFinder("req-1")(EVENT)).toEqual({
      posterId: "owner-1",
      posterEmail: "owner@example.test",
      enquirerName: "Priya Raman",
      enquirerEmail: "priya@example.test",
      title: "2 BHK apartment in Adyar",
      pagePath: "/properties/two-bhk-adyar-k3x9a2bd",
      dashboardPath: "/dashboard?tab=received",
    });
    expect(reads).toEqual([
      {
        table: "enquiries",
        columns: "name, email, properties(title, slug, short_id, owner_id)",
        column: "id",
        value: "enquiry-1",
      },
    ]);
    // The poster's address is one server-only function, asked about the home's owner (never a client value).
    expect(calls).toEqual([{ name: "poster_mail_address", args: { p_owner: "owner-1" } }]);
  });

  it("never selects the phone or the message of the enquiry", async () => {
    answers.set("enquiries", { data: HOME, error: null });
    await createEnquiryMailFinder("req-1")(EVENT);
    for (const read of reads) {
      expect(read.columns).not.toMatch(/phone|message|\*/u);
    }
  });

  it("answers no poster address when there is none, and no enquirer address when none was typed", async () => {
    answers.set("enquiries", { data: { ...HOME, email: null }, error: null });
    answers.set("poster_mail_address", { data: null, error: null });
    expect(await createEnquiryMailFinder("req-1")(EVENT)).toMatchObject({
      posterEmail: null,
      enquirerEmail: null,
    });
    answers.set("poster_mail_address", { data: "", error: null });
    expect(await createEnquiryMailFinder("req-1")(EVENT)).toMatchObject({ posterEmail: null });
  });

  it("answers nothing for another kind of event, and for an enquiry or home that is gone", async () => {
    const find = createEnquiryMailFinder("req-1");
    expect(await find({ kind: "project_lead.received", leadId: "lead-1" })).toBeNull();
    expect(reads).toEqual([]);
    expect(calls).toEqual([]);
    answers.set("enquiries", { data: null, error: null });
    expect(await find(EVENT)).toBeNull();
    answers.set("enquiries", { data: { ...HOME, properties: null }, error: null });
    expect(await find(EVENT)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("throws, with words that name no person, when a read fails", async () => {
    const find = createEnquiryMailFinder("req-1");
    answers.set("enquiries", { data: null, error: { code: "XX000", message: "x" } });
    await expect(find(EVENT)).rejects.toMatchObject({ code: "INTERNAL" });
    answers.set("enquiries", { data: HOME, error: null });
    answers.set("poster_mail_address", { data: null, error: { code: "XX000", message: "x" } });
    await expect(find(EVENT)).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
