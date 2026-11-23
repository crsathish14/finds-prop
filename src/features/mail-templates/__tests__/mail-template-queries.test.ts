import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MAIL_TEMPLATES } from "@/lib/mail-template";

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  keys: [] as string[][],
  error: vi.fn(),
  tag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: mocks.tag }));
vi.mock("@/server/logger", () => ({ logger: { error: mocks.error } }));

/** A client that records which rows it was asked for and answers what the test says. */
function client() {
  return {
    from: () => ({
      select: () => ({
        in: (_column: string, keys: string[]) => {
          mocks.keys.push(keys);
          return mocks.answer();
        },
      }),
    }),
  };
}
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => client() }));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: () => Promise.resolve(client()),
}));

const { getMailTemplates, getMailTemplatesEditPage } = await import("../queries");

const stored = (subject: string, updated: string | null = "2026-11-24") => ({
  subject,
  body: "Body {enquirerName}",
  updated,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.keys.length = 0;
});

describe("UT-mail-template-queries: what the mail code sends with (ADR-183)", () => {
  it("asks for the two known rows only and tags the read with the site content", async () => {
    mocks.answer.mockResolvedValue({ data: [], error: null });
    await getMailTemplates();
    expect(mocks.keys).toEqual([["mail_enquiry_poster", "mail_enquiry_sender"]]);
    expect(mocks.tag).toHaveBeenCalledTimes(1);
  });

  it("uses the published wording of each row, and the wording in code where there is none", async () => {
    mocks.answer.mockResolvedValue({
      data: [
        {
          key: "mail_enquiry_poster",
          value: { published: stored("Live {enquirerName}"), working: stored("Draft", null) },
        },
        { key: "mail_enquiry_sender", value: { working: stored("Only a draft", null) } },
      ],
      error: null,
    });
    expect(await getMailTemplates()).toEqual({
      enquiry_poster: { subject: "Live {enquirerName}", body: "Body {enquirerName}" },
      enquiry_sender: DEFAULT_MAIL_TEMPLATES.enquiry_sender,
    });
  });

  it("ignores a row that is not in the shape or breaks a rule", async () => {
    mocks.answer.mockResolvedValue({
      data: [
        { key: "mail_enquiry_poster", value: { published: { subject: "{phone}", body: "x" } } },
        { key: "mail_enquiry_sender", value: "text" },
      ],
      error: null,
    });
    expect(await getMailTemplates()).toEqual({ ...DEFAULT_MAIL_TEMPLATES });
  });

  it("uses the wording in code and logs only the code when the read fails", async () => {
    mocks.answer.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "secret detail" },
    });
    expect(await getMailTemplates()).toEqual({ ...DEFAULT_MAIL_TEMPLATES });
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("secret");
  });
});

describe("UT-mail-template-queries: what the editor opens on", () => {
  it("opens on the working copy, else the live wording, else the wording in code", async () => {
    mocks.answer.mockResolvedValue({
      data: [
        {
          key: "mail_enquiry_poster",
          value: {
            published: stored("Live {enquirerName}"),
            working: stored("Draft {enquirerName}", null),
          },
        },
      ],
      error: null,
    });
    const page = await getMailTemplatesEditPage();
    expect(page.enquiry_poster).toEqual({
      kind: "enquiry_poster",
      template: { subject: "Draft {enquirerName}", body: "Body {enquirerName}" },
      hasUnpublishedChanges: true,
      published: { updated: "2026-11-24" },
    });
    expect(page.enquiry_sender).toEqual({
      kind: "enquiry_sender",
      template: DEFAULT_MAIL_TEMPLATES.enquiry_sender,
      hasUnpublishedChanges: false,
      published: null,
    });
  });

  it("opens on the live wording when there is no working copy", async () => {
    mocks.answer.mockResolvedValue({
      data: [{ key: "mail_enquiry_sender", value: { published: stored("Live") } }],
      error: null,
    });
    const page = await getMailTemplatesEditPage();
    expect(page.enquiry_sender).toMatchObject({
      template: { subject: "Live" },
      hasUnpublishedChanges: false,
      published: { updated: "2026-11-24" },
    });
  });

  it("throws when the read fails, so the error page shows it", async () => {
    mocks.answer.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(getMailTemplatesEditPage()).rejects.toThrow("could not be read");
  });
});
