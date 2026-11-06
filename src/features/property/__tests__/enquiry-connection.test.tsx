// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ConnectedEnquiryCard } from "../connected-enquiry-card.client";
import type { EnquiryConnection, SendEnquiryAction } from "../use-enquiry-form.client";

import { resetDraftsForTests, saveDraft } from "@/lib/form-draft";

const notes = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: notes }));

const card = en.domain.enquiry;
const ended = en.domain.sessionEnded;

beforeEach(() => {
  window.sessionStorage.clear();
  resetDraftsForTests();
  notes.info.mockReset();
});

const ok: ActionResult<{ received: true }> = { ok: true, data: { received: true } };

function connect(send: SendEnquiryAction, prefill: EnquiryConnection["prefill"] = {}) {
  return { shortId: "k3x9a2bd", send, prefill, enquiriesHref: "/dashboard?tab=sent" };
}

async function sendWith(result: ActionResult<{ received: true }>, prefill = {}) {
  const send = vi.fn(async () => result);
  renderWithMessages(<ConnectedEnquiryCard connection={connect(send, prefill)} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: card.form.send }));
  });
  return send;
}

describe("the enquiry card connected to the action (S5-T03)", () => {
  it("starts with the account's own name, phone and email, which can be changed", () => {
    const send = vi.fn(async () => ok);
    renderWithMessages(
      <ConnectedEnquiryCard
        connection={connect(send, {
          name: "Priya Raman",
          phone: "919840012345",
          email: "priya@example.test",
        })}
      />,
    );
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman");
    expect(screen.getByLabelText(/Phone/)).toHaveValue("919840012345");
    expect(screen.getByLabelText(/Email/)).toHaveValue("priya@example.test");
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "98400 99999" } });
    expect(screen.getByLabelText(/Phone/)).toHaveValue("98400 99999");
  });

  it("sends what is typed for this home with one key, and shows the confirmation", async () => {
    const send = await sendWith(ok, { name: "Priya Raman", phone: "919840012345" });
    expect(send).toHaveBeenCalledWith({
      shortId: "k3x9a2bd",
      name: "Priya Raman",
      phone: "919840012345",
      email: "",
      message: "",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(screen.getByText(card.sent.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: card.sent.viewEnquiries })).toHaveAttribute(
      "href",
      "/dashboard?tab=sent",
    );
  });

  it("keeps the same key for a retry of the same form", async () => {
    const send = vi.fn<SendEnquiryAction>(async () => ({ ok: false, code: "UPSTREAM_FAILED" }));
    renderWithMessages(
      <ConnectedEnquiryCard
        connection={connect(send, { name: "Priya Raman", phone: "919840012345" })}
      />,
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: card.form.send }));
      });
    }
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].idempotencyKey).toBe(send.mock.calls[1]?.[0].idempotencyKey);
  });

  it("says an enquiry about this home was already sent when the server reports a conflict", async () => {
    await sendWith({ ok: false, code: "CONFLICT" });
    expect(screen.getByText(card.already.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: card.sent.viewEnquiries })).toBeInTheDocument();
  });

  it("asks to wait a little when too many were sent today, and keeps the form", async () => {
    await sendWith({ ok: false, code: "RATE_LIMITED", retryAfter: 3600 }, { name: "Priya Raman" });
    expect(screen.getByText(card.rateLimit.title)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman");
  });

  it("says it is the visitor's own home, and switches Send off", async () => {
    await sendWith({ ok: false, code: "FORBIDDEN" });
    expect(screen.getByText(card.ownHome.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: card.form.send })).toBeDisabled();
  });

  it("does not call a missing verified phone the visitor's own home: the session has ended", async () => {
    await sendWith({ ok: false, code: "FORBIDDEN", reason: "PHONE_NOT_VERIFIED" });
    expect(screen.queryByText(card.ownHome.title)).toBeNull();
    expect(screen.queryByText(card.failed.title)).toBeNull();
    expect(screen.getByText(en.domain.sessionEnded.title)).toBeInTheDocument();
  });

  it("shows a field's own message under that field", async () => {
    await sendWith({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.nameTooShort" }] },
    });
    expect(screen.getByText(en.validation.nameTooShort)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("says it could not send, keeping what was typed, for any other failure", async () => {
    await sendWith({ ok: false, code: "INTERNAL" }, { name: "Priya Raman" });
    expect(screen.getByText(card.failed.title)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman");
  });

  it("says it could not send when the request itself does not get through", async () => {
    const send = vi.fn(async () => {
      throw new Error("offline");
    });
    renderWithMessages(<ConnectedEnquiryCard connection={connect(send as never)} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: card.form.send }));
    });
    expect(screen.getByText(card.failed.title)).toBeInTheDocument();
  });

  it("shows the consent line under Send, with a link to the privacy page", () => {
    renderWithMessages(<ConnectedEnquiryCard connection={connect(vi.fn(async () => ok))} />);
    expect(screen.getByText(new RegExp(card.consent.text))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: card.consent.privacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("says the session has ended, with a link back, when the server says the visitor is not signed in", async () => {
    await sendWith(
      { ok: false, code: "UNAUTHENTICATED" },
      { name: "Priya Raman", phone: "9840012345" },
    );
    expect(screen.getByText(ended.title)).toBeInTheDocument();
    expect(screen.queryByText(card.failed.title)).toBeNull();
    expect(screen.getByRole("link", { name: ended.action })).toHaveAttribute(
      "href",
      "/auth?gate=expired&redirect=" + encodeURIComponent(window.location.pathname),
    );
    // What was typed stays on the form.
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman");
  });

  it("keeps the name, email and message, but not the phone, when Sign in again is pressed", async () => {
    await sendWith(
      { ok: false, code: "UNAUTHENTICATED" },
      { name: "Priya Raman", phone: "9840012345", email: "priya@example.test" },
    );
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: "Is it still free?" } });
    expect(window.sessionStorage.length).toBe(0);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: card.form.send }));
    });
    fireEvent.click(screen.getByRole("link", { name: ended.action }));
    const stored = JSON.parse(
      window.sessionStorage.getItem(window.sessionStorage.key(0) ?? "") ?? "{}",
    );
    expect(stored.values).toEqual({
      name: "Priya Raman",
      email: "priya@example.test",
      message: "Is it still free?",
    });
    expect(JSON.stringify(stored)).not.toContain("9840012345");
  });

  it("does not keep anything just because the session ended: only pressing the link does", async () => {
    await sendWith({ ok: false, code: "UNAUTHENTICATED" }, { name: "Priya Raman" });
    expect(window.sessionStorage.length).toBe(0);
  });

  it("starts again with the kept answers when the visitor comes back, says so once, and uses the new session's phone", async () => {
    saveDraft("enquiry", window.location.pathname, {
      name: "Priya Raman",
      email: "priya@example.test",
      message: "Is it still free?",
    });
    renderWithMessages(
      <ConnectedEnquiryCard
        connection={connect(
          vi.fn(async () => ok),
          { name: "Account Name", phone: "919840012345" },
        )}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman"),
    );
    expect(screen.getByLabelText(/Email/)).toHaveValue("priya@example.test");
    expect(screen.getByLabelText(/Message/)).toHaveValue("Is it still free?");
    expect(screen.getByLabelText(/Phone/)).toHaveValue("919840012345");
    expect(notes.info).toHaveBeenCalledTimes(1);
    expect(notes.info).toHaveBeenCalledWith(ended.restored);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("forgets the kept answers once the enquiry is sent", async () => {
    saveDraft("enquiry", window.location.pathname, { name: "Priya Raman" });
    renderWithMessages(
      <ConnectedEnquiryCard
        connection={connect(
          vi.fn(async () => ok),
          { phone: "919840012345" },
        )}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman"),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: card.form.send }));
    });
    expect(screen.getByText(card.sent.title)).toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
  });
});
