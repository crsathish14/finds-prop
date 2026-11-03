// @vitest-environment jsdom
import { act, configure, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { addEmail, resendEmailLink } from "../actions";
import { EmailStep } from "../email-step.client";
import { goTo } from "../navigate";

// The actions reach the server and goTo leaves the page; the tests stand in for both.
vi.mock("../actions", () => ({ addEmail: vi.fn(), resendEmailLink: vi.fn() }));
vi.mock("../navigate", () => ({ goTo: vi.fn() }));

const words = en.auth.email;
const add = vi.mocked(addEmail);
const again = vi.mocked(resendEmailLink);
const go = vi.mocked(goTo);

type Sent = { email: string; resendAfter: number };
const field = () => screen.getByLabelText(new RegExp(words.label));
const sendButton = () => screen.getByRole("button", { name: words.send });

function answerAdd(result: ActionResult<Sent>) {
  add.mockResolvedValueOnce(result);
}
function answerResend(result: ActionResult<Sent>) {
  again.mockResolvedValueOnce(result);
}

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
function pass(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

/** Moves the clock one second at a time, as the page's own timer does, until the text appears. */
function passUntilShown(text: string) {
  for (let step = 0; step < 70 && !screen.queryByText(text); step += 1) pass(1);
}

// The clock here is partly fake, so a loaded machine needs more than the default second to settle.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

async function sendTo(typed: string, response: ActionResult<Sent>) {
  answerAdd(response);
  renderWithMessages(<EmailStep redirectTo="/properties/home-1" />);
  await user().type(field(), typed);
  await user().click(sendButton());
}

const SENT: ActionResult<Sent> = {
  ok: true,
  data: { email: "priya.raman@example.com", resendAfter: 60 },
};

describe("email step: the entry state (ADD-03)", () => {
  it("asks for an email, in one labelled and required field, and says what it is for", () => {
    renderWithMessages(<EmailStep redirectTo="/dashboard" />);
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByText(words.lead)).toBeInTheDocument();
    expect(field()).toHaveAttribute("type", "email");
    expect(field()).toHaveAttribute("autocomplete", "email");
    expect(field()).toHaveAttribute("aria-required", "true");
  });

  it("lets the visitor skip to where they were headed", async () => {
    renderWithMessages(<EmailStep redirectTo="/properties/home-1" />);
    await user().click(screen.getByRole("button", { name: words.skip }));
    expect(go).toHaveBeenCalledWith("/properties/home-1");
    expect(add).not.toHaveBeenCalled();
  });

  it.each(["", "priya", "priya@", "priya@example", "pri ya@example.com"])(
    "says %j is not a valid address, and asks nothing of the server",
    async (typed) => {
      renderWithMessages(<EmailStep redirectTo="/dashboard" />);
      if (typed) await user().type(field(), typed);
      await user().click(sendButton());
      expect(screen.getByText(en.validation.emailInvalid)).toBeInTheDocument();
      expect(field()).toHaveAttribute("aria-invalid", "true");
      expect(add).not.toHaveBeenCalled();
    },
  );

  it("clears the message as soon as the visitor edits the address", async () => {
    renderWithMessages(<EmailStep redirectTo="/dashboard" />);
    await user().type(field(), "priya");
    await user().click(sendButton());
    await user().type(field(), "@");
    expect(screen.queryByText(en.validation.emailInvalid)).not.toBeInTheDocument();
  });

  it("sends the address as typed and shows where the link went", async () => {
    await sendTo("Priya.Raman@Example.com", SENT);
    expect(add).toHaveBeenCalledWith({ email: "Priya.Raman@Example.com" });
    expect(await screen.findByRole("heading", { level: 1, name: words.sentTitle })).toBeVisible();
    expect(screen.getByText("priya.raman@example.com")).toBeVisible();
    expect(screen.getByText(words.spam)).toBeVisible();
  });

  it("says the address cannot be used, without saying why, and keeps what was typed", async () => {
    await sendTo("someone@example.com", {
      ok: false,
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.emailTaken" }] },
    });
    expect(await screen.findByText(en.validation.emailTaken)).toBeInTheDocument();
    expect(screen.getByText(words.takenNote)).toBeInTheDocument();
    expect(field()).toHaveValue("someone@example.com");
  });

  it("shows the server's verdict when it finds the address invalid", async () => {
    await sendTo("odd@example.com", {
      ok: false,
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.emailInvalid" }] },
    });
    expect(await screen.findByText(en.validation.emailInvalid)).toBeInTheDocument();
  });

  it("shows how long to wait when the limit is reached, in the shared wording", async () => {
    await sendTo("priya@example.com", { ok: false, code: "RATE_LIMITED", retryAfter: 1500 });
    expect(await screen.findByText(/try again in 25 minutes/i)).toBeInTheDocument();
    expect(field()).toHaveValue("priya@example.com");
  });

  it("says something went wrong when sending fails, and keeps the address", async () => {
    await sendTo("priya@example.com", { ok: false, code: "UPSTREAM_FAILED" });
    expect(await screen.findByText(en.errors.UPSTREAM_FAILED)).toBeInTheDocument();
    expect(field()).toHaveValue("priya@example.com");
  });

  it("shows Sending while it waits, and turns the field and Skip off", async () => {
    let finish: (result: ActionResult<Sent>) => void = () => undefined;
    add.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderWithMessages(<EmailStep redirectTo="/dashboard" />);
    await user().type(field(), "priya@example.com");
    await user().click(sendButton());
    expect(await screen.findByRole("button", { name: words.sending })).toBeDisabled();
    expect(field()).toBeDisabled();
    expect(screen.getByRole("button", { name: words.skip })).toBeDisabled();
    await act(async () => finish(SENT));
  });
});

describe("email step: after the link is sent", () => {
  it("counts down before offering the link again, and says so for screen readers at 30 and 10 seconds", async () => {
    await sendTo("priya.raman@example.com", SENT);
    await screen.findByText(words.sentTitle);
    expect(screen.getByText("Send again in 1:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: words.resend })).not.toBeInTheDocument();
    passUntilShown("You can ask for the link again in 30 seconds.");
    expect(screen.getByText("You can ask for the link again in 30 seconds.")).toBeInTheDocument();
    passUntilShown("You can ask for the link again in 10 seconds.");
    expect(screen.getByText("You can ask for the link again in 10 seconds.")).toBeInTheDocument();
    passUntilShown(words.resendReady);
    expect(screen.getByText(words.resendReady)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.resend })).toBeEnabled();
  });

  it("sends the link again, says the newest email is the one to use, and starts the countdown again", async () => {
    await sendTo("priya.raman@example.com", SENT);
    await screen.findByText(words.sentTitle);
    pass(61);
    answerResend(SENT);
    await user().click(screen.getByRole("button", { name: words.resend }));
    expect(again).toHaveBeenCalledWith({ email: "priya.raman@example.com" });
    expect(await screen.findByText(words.resentTitle)).toBeInTheDocument();
    expect(screen.getByText(words.resentBody)).toBeInTheDocument();
    expect(screen.getByText(/Send again in (1:0\d|0:5\d)/)).toBeInTheDocument();
  });

  it("shows how long to wait, and counts that wait down, when the resend is limited", async () => {
    await sendTo("priya.raman@example.com", SENT);
    await screen.findByText(words.sentTitle);
    pass(61);
    answerResend({ ok: false, code: "RATE_LIMITED", retryAfter: 840 });
    await user().click(screen.getByRole("button", { name: words.resend }));
    expect(await screen.findByText(/try again in 14 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/Send again in 1[34]:\d\d/)).toBeInTheDocument();
  });

  it("goes back to the form with the address kept for editing", async () => {
    await sendTo("priya.raman@example.com", SENT);
    await user().click(await screen.findByRole("button", { name: words.different }));
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveValue("priya.raman@example.com"));
  });
});
