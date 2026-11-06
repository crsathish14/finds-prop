// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { resetDraftsForTests, saveDraft } from "@/lib/form-draft";
import { renderWithMessages } from "../../../../tests/render-intl";
import {
  ConnectedForm,
  type SubmitFormAction,
  type SubmitProjectFormAction,
} from "../connected-form.client";
import { CONTACT_FORM } from "../contact-form";

const notes = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: notes }));

const words = messages.domain.dynamicForm;
const ended = messages.domain.sessionEnded;

const OK: ActionResult<{ received: true }> = { ok: true, data: { received: true } };

function setup(send: SubmitFormAction) {
  renderWithMessages(
    <ConnectedForm
      form={CONTACT_FORM}
      send={send}
      source="/contact"
      consent="consent line"
      sent={<p>It was sent</p>}
    />,
  );
}

async function fillAndSend() {
  await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
  await userEvent.type(screen.getByLabelText(/Mobile/), "98400 12345");
  await userEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("ConnectedForm: the contact form connected to the action (S5-T05)", () => {
  it("sends the form's slug, the answers, the page and a one-time key, then shows the confirmation", async () => {
    const send = vi.fn<SubmitFormAction>().mockResolvedValue(OK);
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText("It was sent")).toBeVisible());
    expect(send).toHaveBeenCalledTimes(1);
    const input = send.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      formSlug: "contact",
      source: "/contact",
      values: { name: "Priya Raman", mobile: "98400 12345", email: "", interest: "", message: "" },
    });
    expect(input?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(input).not.toHaveProperty("projectSlug");
  });

  it("uses the form's own button words", () => {
    setup(vi.fn<SubmitFormAction>());
    expect(screen.getByRole("button", { name: "Send message" })).toBeVisible();
  });

  it("puts the server's field messages beside the fields and keeps what was typed", async () => {
    const send = vi.fn<SubmitFormAction>().mockResolvedValue({
      ok: false,
      code: "VALIDATION",

      fieldErrors: { mobile: [{ key: "validation.phoneInvalid" }] },
    });
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByLabelText(/Mobile/)).toBeInvalid());
    expect(screen.getByLabelText(/Mobile/)).toHaveAccessibleDescription(
      messages.validation.phoneInvalid,
    );
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman");
    expect(screen.queryByText("It was sent")).not.toBeInTheDocument();
  });

  it("says the limit is reached, with the form kept", async () => {
    const send = vi
      .fn<SubmitFormAction>()
      .mockResolvedValue({ ok: false, code: "RATE_LIMITED", retryAfter: 1800 });
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText(words.rateLimit.title)).toBeVisible());
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman");
  });

  it("says it could not send for any other answer, and when the request itself failed", async () => {
    const send = vi
      .fn<SubmitFormAction>()
      .mockResolvedValueOnce({ ok: false, code: "INTERNAL" })
      .mockRejectedValueOnce(new Error("offline"));
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText(words.failed.title)).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(screen.getByText(words.failed.title)).toBeVisible();
  });

  it("sends the same key again for a retry, so a retry stores one submission", async () => {
    const send = vi
      .fn<SubmitFormAction>()
      .mockResolvedValueOnce({ ok: false, code: "INTERNAL" })
      .mockResolvedValueOnce(OK);
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText(words.failed.title)).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText("It was sent")).toBeVisible());
    expect(send.mock.calls[1]?.[0].idempotencyKey).toBe(send.mock.calls[0]?.[0].idempotencyKey);
  });

  it("names the project page when the form is shown on one", async () => {
    const send = vi.fn<SubmitFormAction>().mockResolvedValue(OK);
    renderWithMessages(
      <ConnectedForm
        form={CONTACT_FORM}
        send={send}
        source="/projects/kadal-vista"
        projectSlug="kadal-vista"
        sent={<p>It was sent</p>}
      />,
    );
    await fillAndSend();
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0]?.[0]).toMatchObject({ projectSlug: "kadal-vista" });
  });
});

describe("ConnectedForm: a project's form (S5-T05, change 4)", () => {
  function setupProject(send: SubmitProjectFormAction) {
    renderWithMessages(
      <ConnectedForm
        form={CONTACT_FORM}
        sendProject={send}
        projectSlug="kadal-vista"
        compact
        intro={<h2>Interested in this project?</h2>}
        locked={{ mobile: { value: "+91 98••• ••345" } }}
        consent="consent line"
        sent={<p>It was sent</p>}
      />,
    );
  }

  it("sends the project, the answers and a one-time key, with no form named and no source, then shows the confirmation and drops the heading", async () => {
    const send = vi.fn<SubmitProjectFormAction>().mockResolvedValue(OK);
    setupProject(send);
    expect(screen.getByRole("heading", { name: "Interested in this project?" })).toBeVisible();
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText("It was sent")).toBeVisible());
    expect(screen.queryByRole("heading", { name: "Interested in this project?" })).toBeNull();
    const input = send.mock.calls[0]?.[0];
    expect(input).toMatchObject({ projectSlug: "kadal-vista", values: { name: "Priya Raman" } });
    expect(input?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(input).not.toHaveProperty("formSlug");
    expect(input).not.toHaveProperty("source");
  });

  it("shows the locked phone and keeps the typed answers when the server refuses a field", async () => {
    const send = vi.fn<SubmitProjectFormAction>().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.required" }] },
    });
    setupProject(send);
    expect(screen.getByLabelText(/Mobile/)).toHaveValue("+91 98••• ••345");
    await userEvent.type(screen.getByLabelText(/Your name/), "P");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByLabelText(/Your name/)).toBeInvalid());
    expect(screen.getByLabelText(/Your name/)).toHaveValue("P");
  });

  it("asks the visitor to wait when the limit is reached", async () => {
    const send = vi
      .fn<SubmitProjectFormAction>()
      .mockResolvedValue({ ok: false, code: "RATE_LIMITED", retryAfter: 60 });
    setupProject(send);
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText(words.rateLimit.title)).toBeVisible());
  });
});

describe("ConnectedForm: the session ended before a project's form was sent (S5-T07)", () => {
  function setupProject(send: SubmitProjectFormAction) {
    renderWithMessages(
      <ConnectedForm
        form={CONTACT_FORM}
        sendProject={send}
        projectSlug="kadal-vista"
        compact
        locked={{ mobile: { value: "+91 98••• ••345" } }}
        sent={<p>It was sent</p>}
      />,
    );
  }
  const unauthenticated = {
    ok: false as const,
    code: "UNAUTHENTICATED" as const,
  };

  beforeEach(() => {
    window.sessionStorage.clear();
    resetDraftsForTests();
    notes.info.mockReset();
  });

  it("says the session has ended, with a link back to the card, and keeps what was typed on the form", async () => {
    setupProject(vi.fn<SubmitProjectFormAction>().mockResolvedValue(unauthenticated));
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText(ended.title)).toBeVisible());
    expect(screen.getByRole("link", { name: ended.action })).toHaveAttribute(
      "href",
      "/auth?gate=expired&redirect=" + encodeURIComponent(window.location.pathname + "#enquiry"),
    );
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman");
    expect(screen.queryByText(words.failed.title)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("treats a missing verified phone the same way", async () => {
    setupProject(
      vi
        .fn<SubmitProjectFormAction>()
        .mockResolvedValue({ ok: false, code: "FORBIDDEN", reason: "PHONE_NOT_VERIFIED" }),
    );
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText(ended.title)).toBeVisible());
  });

  it("keeps the typed answers, but not the locked phone, when Sign in again is pressed", async () => {
    setupProject(vi.fn<SubmitProjectFormAction>().mockResolvedValue(unauthenticated));
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.type(screen.getByLabelText(/Message/), "Is a 3 BHK left?");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText(ended.title)).toBeVisible());
    await userEvent.click(screen.getByRole("link", { name: ended.action }));
    const stored = JSON.parse(
      window.sessionStorage.getItem(window.sessionStorage.key(0) ?? "") ?? "{}",
    );
    expect(stored.values).toMatchObject({ name: "Priya Raman", message: "Is a 3 BHK left?" });
    expect(stored.values).not.toHaveProperty("mobile");
  });

  it("starts again with the kept answers when the visitor comes back, says so once, and keeps the phone locked", async () => {
    saveDraft("project-form", window.location.pathname, {
      name: "Priya Raman",
      message: "Is a 3 BHK left?",
      mobile: "must not come back",
    });
    setupProject(vi.fn<SubmitProjectFormAction>().mockResolvedValue(OK));
    await waitFor(() => expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman"));
    expect(screen.getByLabelText(/Message/)).toHaveValue("Is a 3 BHK left?");
    expect(screen.getByLabelText(/Mobile/)).toHaveValue("+91 98••• ••345");
    expect(notes.info).toHaveBeenCalledTimes(1);
    expect(notes.info).toHaveBeenCalledWith(ended.restored);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("forgets the kept answers once the form is sent", async () => {
    saveDraft("project-form", window.location.pathname, { name: "Priya Raman" });
    setupProject(vi.fn<SubmitProjectFormAction>().mockResolvedValue(OK));
    await waitFor(() => expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman"));
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText("It was sent")).toBeVisible());
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not look for kept answers on the contact form, which anyone may send", async () => {
    saveDraft("project-form", window.location.pathname, { name: "Priya Raman" });
    setup(vi.fn<SubmitFormAction>());
    expect(screen.getByLabelText(/Your name/)).toHaveValue("");
    expect(notes.info).not.toHaveBeenCalled();
  });
});
