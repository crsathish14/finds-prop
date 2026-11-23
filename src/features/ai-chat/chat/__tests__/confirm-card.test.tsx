// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../../tests/render-intl";
import type { ConfirmCard } from "../../confirm/confirm-card";

// UT-ai-confirm-card-ui (ADR-128 D-ACTION, AI-P6-T02): the confirm card wired to the server action. The action is
// handed in, so no network and no database; the real card parts and the real wording are drawn.

vi.mock("../../actions", () => ({ confirmChatProposal: vi.fn() }));
const { ChatConfirm, CHAT_SIGN_IN_HREF } = await import("../confirm-card.client");

const words = messages.ai.confirm;
const enquiry = messages.domain.enquiry;
const ended = messages.domain.sessionEnded;
const lead = messages.projects.page.lead;

const MESSAGE = "Is this home still available? I would like to visit this Saturday.";

const READY: ConfirmCard = {
  state: "ready",
  kind: "enquiry",
  proposal: "body.signature",
  target: { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" },
  name: "Priya Raman",
  phone: "+91 98400 12345",
  message: MESSAGE,
};
const READY_VISIT: ConfirmCard = {
  ...READY,
  kind: "visit",
  target: { title: "Kadal Vista", meta: "Adyar · Kadal Homes" },
  visitDate: "5 Dec 2026",
  builderName: "Kadal Homes",
};
const READY_PROJECT_ENQUIRY: ConfirmCard = {
  ...READY,
  about: "project",
  target: { title: "Kadal Vista", meta: "Adyar · Kadal Homes" },
};
const SIGNED_OUT: ConfirmCard = {
  state: "signed_out",
  kind: "enquiry",
  target: READY.target,
  message: MESSAGE,
};

const ok: ActionResult<{ received: true }> = { ok: true, data: { received: true } };
const failure = (
  code: Extract<ActionResult<never>, { ok: false }>["code"],
  extra: object = {},
): ActionResult<{ received: true }> => ({ ok: false, code, ...extra });

const send =
  vi.fn<
    (input: {
      proposal: string;
      idempotencyKey: string;
    }) => Promise<ActionResult<{ received: true }>>
  >();
const keep = vi.fn();

function draw(card: ConfirmCard) {
  return renderWithMessages(<ChatConfirm card={card} onKeepMessage={keep} send={send} />);
}

const sendButton = (name: string = enquiry.form.send) =>
  screen.getByRole("button", { name: new RegExp(name) });

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue(ok);
});

describe("UT-ai-confirm-card-ui: what the card shows before anything is sent", () => {
  it("shows the real target, the account's name, the verified phone in full, the message and the one Send button", () => {
    draw(READY);
    expect(screen.getByRole("region", { name: words.enquiryTitle })).toBeVisible();
    expect(screen.getByText("3 BHK apartment")).toBeVisible();
    expect(screen.getByText("Velachery · ₹1.25 Cr")).toBeVisible();
    expect(screen.getByText("Priya Raman")).toBeVisible();
    expect(screen.getByText("+91 98400 12345")).toBeVisible();
    expect(screen.getByText(words.verified)).toBeVisible();
    expect(screen.getByText(MESSAGE)).toBeVisible();
    expect(screen.getByText(enquiry.consent.text, { exact: false })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("shows a site visit with its day and names the developer in the consent line", () => {
    draw(READY_VISIT);
    expect(screen.getByRole("region", { name: words.visitTitle })).toBeVisible();
    expect(screen.getByText("5 Dec 2026")).toBeVisible();
    expect(screen.getByText(/go to Kadal Homes and findsprop/)).toBeVisible();
    expect(sendButton(words.requestVisit)).toBeVisible();
  });
});

describe("UT-ai-confirm-card-ui: the click", () => {
  it("sends the proposal with a fresh idempotency key and nothing else, then shows the sent card", async () => {
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(send).toHaveBeenCalledExactlyOnceWith({
      proposal: "body.signature",
      idempotencyKey: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/),
    });
    expect(await screen.findByRole("heading", { name: enquiry.sent.title })).toBeVisible();
    expect(screen.getByRole("link", { name: enquiry.sent.viewEnquiries })).toHaveAttribute(
      "href",
      "/dashboard?tab=sent",
    );
  });

  it("sends a plain project enquiry the same way, and does not point to a list of home enquiries it is not in (ADR-176)", async () => {
    const user = userEvent.setup();
    draw(READY_PROJECT_ENQUIRY);
    expect(screen.getByText("Kadal Vista")).toBeVisible();
    expect(screen.queryByText("5 Dec 2026")).toBeNull();
    await user.click(sendButton());
    expect(send).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: enquiry.sent.title })).toBeVisible();
    expect(screen.queryByRole("link", { name: enquiry.sent.viewEnquiries })).toBeNull();
  });

  it("sends a site visit the same way and shows the project page's own thank-you", async () => {
    const user = userEvent.setup();
    draw(READY_VISIT);
    await user.click(sendButton(words.requestVisit));
    expect(send).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: lead.sent.title })).toBeVisible();
  });

  it("sends once however many times the button is pressed while it is working", async () => {
    let release: (value: ActionResult<{ received: true }>) => void = () => undefined;
    send.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    await user.click(sendButton());
    await user.click(sendButton());
    expect(send).toHaveBeenCalledOnce();
    release(ok);
    expect(await screen.findByRole("heading", { name: enquiry.sent.title })).toBeVisible();
  });

  it("keeps the card and the same key when sending fails, so Send can be pressed again", async () => {
    send.mockResolvedValueOnce(failure("INTERNAL", { requestId: "r1" }));
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByText(enquiry.failed.title)).toBeVisible();
    expect(screen.getByText(MESSAGE)).toBeVisible();
    await user.click(sendButton());
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0].idempotencyKey).toBe(send.mock.calls[0]?.[0].idempotencyKey);
    expect(await screen.findByRole("heading", { name: enquiry.sent.title })).toBeVisible();
  });

  it("says so when the request itself did not get through, and keeps the card", async () => {
    send.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByText(enquiry.failed.title)).toBeVisible();
    expect(sendButton()).toBeEnabled();
  });

  it("shows 'please wait' with Send off when a limit is used up", async () => {
    send.mockResolvedValueOnce(failure("RATE_LIMITED", { retryAfter: 3600 }));
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByText(enquiry.rateLimit.title)).toBeVisible();
    expect(sendButton()).toBeDisabled();
  });

  it("shows the project page's 'please wait' for a site visit", async () => {
    send.mockResolvedValueOnce(failure("RATE_LIMITED"));
    const user = userEvent.setup();
    draw(READY_VISIT);
    await user.click(sendButton(words.requestVisit));
    expect(await screen.findByText(lead.rateLimit.title)).toBeVisible();
  });

  it("never says 'already contacted' for a project enquiry: a conflict there is a plain failure", async () => {
    send.mockResolvedValueOnce(failure("CONFLICT"));
    const user = userEvent.setup();
    draw(READY_PROJECT_ENQUIRY);
    await user.click(sendButton());
    expect(await screen.findByText(enquiry.failed.title)).toBeVisible();
    expect(screen.queryByText(enquiry.already.title)).toBeNull();
  });

  it("shows 'already contacted' when an enquiry about this home was sent in the last day", async () => {
    send.mockResolvedValueOnce(failure("CONFLICT"));
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByText(enquiry.already.title)).toBeVisible();
    expect(screen.queryByRole("button", { name: new RegExp(enquiry.form.send) })).toBeNull();
  });

  it("says the request is no longer valid, with Send off, when the proposal was refused or has run out", async () => {
    send.mockResolvedValueOnce(failure("NOT_FOUND"));
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByText(words.expiredTitle)).toBeVisible();
    expect(screen.getByText(words.expiredBody)).toBeVisible();
    expect(sendButton()).toBeDisabled();
  });

  it("shows a field problem as 'couldn't send', never as a sent card", async () => {
    send.mockResolvedValueOnce(
      failure("VALIDATION", { fieldErrors: { name: [{ key: "validation.nameTooShort" }] } }),
    );
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByText(enquiry.failed.title)).toBeVisible();
    expect(screen.queryByRole("heading", { name: enquiry.sent.title })).toBeNull();
  });
});

describe("UT-ai-confirm-card-ui: the session ended", () => {
  it.each([
    ["the session is gone", failure("UNAUTHENTICATED")],
    ["the phone is no longer verified", failure("FORBIDDEN", { reason: "PHONE_NOT_VERIFIED" })],
  ])("when %s, the card says so and keeps the message for the way back", async (_name, result) => {
    send.mockResolvedValueOnce(result);
    const user = userEvent.setup();
    draw(READY);
    await user.click(sendButton());
    expect(await screen.findByRole("heading", { name: ended.title })).toBeVisible();
    expect(screen.getByText(MESSAGE)).toBeVisible();
    const signIn = screen.getByRole("link", { name: ended.action });
    expect(signIn).toHaveAttribute("href", "/auth?gate=expired&redirect=%2Fai-search");
    expect(keep).not.toHaveBeenCalled();
    await user.click(signIn);
    expect(keep).toHaveBeenCalledExactlyOnceWith(MESSAGE);
  });
});

describe("UT-ai-confirm-card-ui: the sign-in prompt", () => {
  it("has no Send button, quotes the message and leads to sign-in and back to the chat", async () => {
    const user = userEvent.setup();
    draw(SIGNED_OUT);
    expect(screen.getByRole("heading", { name: words.signedOutTitle })).toBeVisible();
    expect(screen.getByText(MESSAGE)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    const signIn = screen.getByRole("link", { name: words.signInToSend });
    expect(signIn).toHaveAttribute("href", CHAT_SIGN_IN_HREF);
    expect(CHAT_SIGN_IN_HREF).toBe("/auth?redirect=%2Fai-search");
    await user.click(signIn);
    await waitFor(() => expect(keep).toHaveBeenCalledExactlyOnceWith(MESSAGE));
    expect(send).not.toHaveBeenCalled();
  });

  it("asks a visitor to sign in to request a site visit in the visit's own words", () => {
    draw({
      ...SIGNED_OUT,
      kind: "visit",
      visitDate: "5 Dec 2026",
      builderName: "Kadal Homes",
    });
    expect(screen.getByRole("heading", { name: words.visitSignedOutTitle })).toBeVisible();
    expect(screen.getByRole("link", { name: words.signInToSend })).toHaveAttribute(
      "href",
      CHAT_SIGN_IN_HREF,
    );
  });
});
