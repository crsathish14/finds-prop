import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ edit: vi.fn() }));

vi.mock("@/features/mail-templates", () => ({
  getMailTemplatesEditPage: mocks.edit,
  saveMailTemplate: "the save action",
  MailTemplatesForm: () => null,
}));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));

const page = await import("../emails/page");

type Child = { type: unknown; key: string; props: Record<string, unknown> };
const PAGES = {
  enquiry_poster: {
    kind: "enquiry_poster",
    template: { subject: "S", body: "B" },
    hasUnpublishedChanges: true,
    published: { updated: "2026-11-24" },
  },
  enquiry_sender: {
    kind: "enquiry_sender",
    template: { subject: "S2", body: "B2" },
    hasUnpublishedChanges: false,
    published: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.edit.mockResolvedValue(PAGES);
});

describe("UT-mail-template-admin-page: the Emails page (ADR-183, part C)", () => {
  it("reads both mails as the admin and gives the form the save action", async () => {
    const element = (await page.default()) as unknown as Child;
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(element.props).toMatchObject({ pages: PAGES, save: "the save action" });
  });

  it("opens the form fresh when what is saved changes, so the boxes never keep old text", async () => {
    const first = (await page.default()) as unknown as Child;
    mocks.edit.mockResolvedValue({
      ...PAGES,
      enquiry_sender: { ...PAGES.enquiry_sender, hasUnpublishedChanges: true },
    });
    const second = (await page.default()) as unknown as Child;
    expect(first.key).not.toEqual(second.key);
  });

  it("names the page in the tab title", async () => {
    expect((await page.generateMetadata()).title).toBe("admin.emails.metaTitle");
  });
});
