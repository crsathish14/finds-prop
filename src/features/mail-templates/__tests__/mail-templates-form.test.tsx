// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { DEFAULT_MAIL_TEMPLATES } from "@/lib/mail-template";
import type { ActionResult } from "@/types/action";
import type { MailTemplateEditPage } from "../types";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { MailTemplatesForm } = await import("../mail-templates-form.client");

const PAGES = {
  enquiry_poster: {
    kind: "enquiry_poster",
    template: DEFAULT_MAIL_TEMPLATES.enquiry_poster,
    hasUnpublishedChanges: false,
    published: null,
  },
  enquiry_sender: {
    kind: "enquiry_sender",
    template: DEFAULT_MAIL_TEMPLATES.enquiry_sender,
    hasUnpublishedChanges: true,
    published: { updated: "2026-11-24" },
  },
} satisfies Record<string, MailTemplateEditPage>;

function nth<T>(list: T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error("no such element");
  return item;
}

const ok: ActionResult<unknown> = { ok: true, data: {} };

beforeEach(() => vi.clearAllMocks());

function open(save = vi.fn().mockResolvedValue(ok)) {
  renderWithMessages(<MailTemplatesForm pages={PAGES} save={save} />);
  return save;
}

describe("UT-mail-templates-form: the Emails page (ADR-183, part C)", () => {
  it("shows both mails with their wording, their status and a preview filled with made-up values", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Emails" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mail to the poster" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Confirmation to the enquirer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Not published yet. The standard wording is sent."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Live since 2026-11-24. You have a saved draft that is not live yet."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("You got an enquiry from Sample Name").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Subject")).toHaveLength(2);
  });

  it("lists only the words each mail may use, in curly brackets", () => {
    open();
    expect(screen.getAllByText("{dashboardLink}")).toHaveLength(1);
    expect(screen.getAllByText("{enquirerName}")).toHaveLength(2);
  });

  it("Save draft sends the mail's own boxes without publishing, then reads the page again", async () => {
    const save = open();
    await userEvent.click(nth(screen.getAllByRole("button", { name: "Save draft" }), 0));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      kind: "enquiry_poster",
      subject: DEFAULT_MAIL_TEMPLATES.enquiry_poster.subject,
      body: DEFAULT_MAIL_TEMPLATES.enquiry_poster.body,
      publish: false,
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Draft saved", expect.anything());
  });

  it("Publish sends publish true for that mail only", async () => {
    const save = open();
    await userEvent.click(nth(screen.getAllByRole("button", { name: "Publish" }), 1));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "enquiry_sender", publish: true }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Published", expect.anything()));
  });

  it("puts the server's problem on its box and does not read the page again", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { body: [{ key: "validation.mailPlaceholderUnknown" }] },
    });
    open(save);
    await userEvent.click(nth(screen.getAllByRole("button", { name: "Save draft" }), 0));
    expect(await screen.findByText(/not allowed here/)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("shows the standard wording and says so when the typed wording cannot be used", async () => {
    open();
    const subject = nth(screen.getAllByLabelText("Subject"), 0);
    await userEvent.clear(subject);
    await userEvent.click(subject);
    await userEvent.paste("{phone} enquiry");
    expect(screen.getAllByText(/standard wording is shown here/).length).toBeGreaterThan(0);
  });

  it("Discard puts the boxes back to what was loaded", async () => {
    open();
    const subject = nth(screen.getAllByLabelText("Subject"), 0) as HTMLInputElement;
    await userEvent.type(subject, "!");
    expect(subject.value.endsWith("!")).toBe(true);
    await userEvent.click(nth(screen.getAllByRole("button", { name: "Discard" }), 0));
    expect(subject.value).toBe(DEFAULT_MAIL_TEMPLATES.enquiry_poster.subject);
  });
});
