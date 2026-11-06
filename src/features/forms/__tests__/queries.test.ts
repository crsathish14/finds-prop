import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as null | { code?: string; message?: string } },
  rpc: { data: [] as unknown[], error: null as null | { code?: string; message?: string } },
  asked: [] as string[],
}));
const cache = vi.hoisted(() => ({ tag: vi.fn(), life: vi.fn() }));
const error = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: cache.tag, cacheLife: cache.life }));
vi.mock("@/server/logger", () => ({ logger: { error } }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({
    rpc: async (name: string, args: unknown) => {
      db.asked.push("rpc " + name + " " + JSON.stringify(args));
      return db.rpc;
    },
    from: (table: string) => ({
      select: (columns: string) => {
        db.asked.push(table + ":" + columns);
        const chain = {
          eq: (column: string, value: unknown) => {
            db.asked.push(column + "=" + String(value));
            return chain;
          },
          order: (column: string, options: { ascending: boolean }) => {
            db.asked.push("order " + column + (options.ascending ? " asc" : " desc"));
            return chain;
          },
          limit: (count: number) => {
            db.asked.push("limit " + count);
            return chain;
          },
          maybeSingle: async () => db.result,
        };
        return chain;
      },
    }),
  }),
}));

const { getContactForm, getProjectForm, FORMS_TAG } = await import("../queries");

const ROW = {
  slug: "contact",
  name: "Contact us",
  kind: "contact",
  placement: "contact",
  project_id: null,
  button_text: "Send message",
  success_message: "Thanks!",
  fields: [{ label: "Your name", key: "name", type: "text", required: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.result = { data: null, error: null };
  db.rpc = { data: [], error: null };
  db.asked = [];
});

describe("UT-forms-queries: reading the contact page's form (S5-T05)", () => {
  it("reads the newest active form placed on the contact page, without the CRM link, and tags the read", async () => {
    db.result = { data: ROW, error: null };
    const form = await getContactForm();
    expect(form).toMatchObject({
      slug: "contact",
      buttonText: "Send message",
      successMessage: "Thanks!",
    });
    expect(form?.fields).toHaveLength(1);
    expect(db.asked).toEqual([
      "forms:slug, name, kind, placement, project_id, button_text, success_message, fields",
      "placement=contact",
      "active=true",
      "order updated_at desc",
      "limit 1",
    ]);
    expect(cache.tag).toHaveBeenCalledWith(FORMS_TAG);
    expect(FORMS_TAG).toBe("forms");
  });

  it("is null, kept for seconds only, when no form is placed on the page", async () => {
    expect(await getContactForm()).toBeNull();
    expect(cache.life).toHaveBeenCalledWith("seconds");
  });

  it("is null and logs only the error code when the read fails", async () => {
    db.result = { data: null, error: { code: "57P01", message: "private detail" } };
    expect(await getContactForm()).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
    expect(cache.life).toHaveBeenCalledWith("seconds");
  });

  it("is null when the stored fields do not fit, so the page says the form could not load", async () => {
    db.result = {
      data: { ...ROW, fields: [{ label: "", key: "Bad Key", type: "magic" }] },
      error: null,
    };
    expect(await getContactForm()).toBeNull();
    expect(error).toHaveBeenCalled();
  });
});

describe("UT-forms-queries: reading the form a project page shows (S5-T05, change 4, BR-49)", () => {
  it("asks the database function, which follows the chain, and tags the read", async () => {
    db.rpc = {
      data: [{ ...ROW, slug: "vista-visit", placement: "project_specific" }],
      error: null,
    };
    const form = await getProjectForm("kadal-vista");
    expect(form).toMatchObject({ slug: "vista-visit", placement: "project_specific" });
    expect(db.asked).toEqual(['rpc public_project_form {"p_project_slug":"kadal-vista"}']);
    expect(cache.tag).toHaveBeenCalledWith(FORMS_TAG);
  });

  it("is null, and kept as any answer is, when the project shows no form (the normal case)", async () => {
    expect(await getProjectForm("kadal-vista")).toBeNull();
    expect(cache.life).toHaveBeenCalledWith("minutes");
    expect(cache.life).not.toHaveBeenCalledWith("seconds");
    expect(error).not.toHaveBeenCalled();
  });

  it("is null and logs only the error code when the read fails", async () => {
    db.rpc = { data: [], error: { code: "57P01", message: "private detail" } };
    expect(await getProjectForm("kadal-vista")).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
    expect(cache.life).toHaveBeenCalledWith("seconds");
  });

  it("is null, so the built-in card shows, when the stored fields do not fit", async () => {
    db.rpc = {
      data: [{ ...ROW, fields: [{ label: "", key: "Bad Key", type: "magic" }] }],
      error: null,
    };
    expect(await getProjectForm("kadal-vista")).toBeNull();
    expect(error).toHaveBeenCalled();
  });
});
