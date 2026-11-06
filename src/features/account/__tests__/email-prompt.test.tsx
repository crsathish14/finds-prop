// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { resetDismissedForTests } from "../email-prompt-dismissed";
import { EmailPrompt, EmailPromptView } from "../email-prompt.client";

const words = en.account.dashboard.email;
const authWords = en.auth.email;
const STORAGE_KEY = "findsprop:email-prompt-dismissed:v1";

type Sent = ActionResult<{ email: string; resendAfter: number }>;
const sentOk = (email = "priya@example.com", resendAfter = 60): Sent => ({
  ok: true,
  data: { email, resendAfter },
});

beforeEach(() => {
  window.localStorage.clear();
  resetDismissedForTests();
});
afterEach(() => {
  vi.useRealTimers();
});

function type(address: string) {
  fireEvent.change(screen.getByLabelText(authWords.label), { target: { value: address } });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: words.send }));
  });
}

describe("EmailPrompt: the card for someone with no email (ADD-03)", () => {
  it("is the card, with a labelled field, Send link and Later", () => {
    const send = vi.fn();
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: words.promptTitle })).toBeInTheDocument();
    expect(screen.getByText(words.promptBody)).toBeInTheDocument();
    expect(screen.getByLabelText(authWords.label)).toHaveAttribute("type", "email");
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.later })).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the address typed and turns into the reminder with a wait before sending again", async () => {
    const send = vi.fn(async () => sentOk());
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    type("priya@example.com");
    await submit();
    expect(send).toHaveBeenCalledWith({ email: "priya@example.com" });
    expect(screen.getByText(words.pendingTitle)).toBeInTheDocument();
    expect(
      screen.getByText("We sent a link to priya@example.com. Open it to finish."),
    ).toBeInTheDocument();
    expect(screen.getByText("Send again in 1:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: authWords.resend })).toBeNull();
  });

  it("does not call the server for an address that is plainly not one", async () => {
    const send = vi.fn();
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    type("not an address");
    await submit();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText(en.validation.emailInvalid)).toBeInTheDocument();
    expect(screen.getByLabelText(authWords.label)).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the problem as soon as the address is edited", async () => {
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={vi.fn()} resend={vi.fn()} />);
    type("nope");
    await submit();
    type("nope@");
    expect(screen.queryByText(en.validation.emailInvalid)).toBeNull();
  });

  it("says an address cannot be used without saying why, when the server refuses it", async () => {
    const send = vi.fn(async (): Promise<Sent> => ({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.emailTaken" }] },
    }));
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    type("taken@example.com");
    await submit();
    expect(screen.getByText(en.validation.emailTaken)).toBeInTheDocument();
    expect(screen.getByText(authWords.takenNote)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
  });

  it("shows the server's address problem as invalid when it is not the taken kind", async () => {
    const send = vi.fn(async (): Promise<Sent> => ({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.emailInvalid" }] },
    }));
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    type("a@b.co");
    await submit();
    expect(screen.getByText(en.validation.emailInvalid)).toBeInTheDocument();
  });

  it("tells a rate-limited visitor how long to wait, and keeps what they typed", async () => {
    const send = vi.fn(async (): Promise<Sent> => ({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    }));
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    type("priya@example.com");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Too many attempts. Please try again in 10 minutes.",
    );
    expect(screen.getByLabelText(authWords.label)).toHaveValue("priya@example.com");
  });

  it("shows a general failure in words, not codes", async () => {
    const send = vi.fn(async (): Promise<Sent> => ({ ok: false, code: "UPSTREAM_FAILED" }));
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={send} resend={vi.fn()} />);
    type("priya@example.com");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(en.errors.UPSTREAM_FAILED);
  });

  it("hides the card for good in this browser when Later is chosen", () => {
    const { unmount } = renderWithMessages(
      <EmailPrompt state={{ kind: "none" }} send={vi.fn()} resend={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: words.later }));
    expect(screen.queryByRole("heading", { name: words.promptTitle })).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
    unmount();
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={vi.fn()} resend={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: words.promptTitle })).toBeNull();
  });

  it("still hides the card for this visit when storage refuses to answer", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderWithMessages(<EmailPrompt state={{ kind: "none" }} send={vi.fn()} resend={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: words.later }));
    expect(screen.queryByRole("heading", { name: words.promptTitle })).toBeNull();
    set.mockRestore();
  });
});

describe("EmailPrompt: the reminder for a link that was sent", () => {
  it("shows when the server already knows a link was sent, and cannot be dismissed", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    renderWithMessages(
      <EmailPrompt
        state={{ kind: "pending", email: "priya@example.com" }}
        send={vi.fn()}
        resend={vi.fn()}
      />,
    );
    expect(screen.getByText(words.pendingTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: words.later })).toBeNull();
    expect(screen.getByRole("button", { name: authWords.resend })).toBeEnabled();
  });

  it("sends the link again to the same address and then waits", async () => {
    const resend = vi.fn(async () => sentOk("priya@example.com", 90));
    renderWithMessages(
      <EmailPrompt
        state={{ kind: "pending", email: "priya@example.com" }}
        send={vi.fn()}
        resend={resend}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: authWords.resend }));
    });
    expect(resend).toHaveBeenCalledWith({ email: "priya@example.com" });
    expect(screen.getByText("Send again in 1:30")).toBeInTheDocument();
    expect(screen.getByText(authWords.resentTitle)).toBeInTheDocument();
  });

  it("counts the wait down and offers the button again", async () => {
    vi.useFakeTimers();
    const resend = vi.fn(async () => sentOk("priya@example.com", 3));
    renderWithMessages(
      <EmailPrompt
        state={{ kind: "pending", email: "priya@example.com" }}
        send={vi.fn()}
        resend={resend}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: authWords.resend }));
    });
    expect(screen.getByText("Send again in 0:03")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole("button", { name: authWords.resend })).toBeEnabled();
  });

  it("shows the wait the server asks for when sending again is limited", async () => {
    const resend = vi.fn(async (): Promise<Sent> => ({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 120,
    }));
    renderWithMessages(
      <EmailPrompt
        state={{ kind: "pending", email: "priya@example.com" }}
        send={vi.fn()}
        resend={resend}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: authWords.resend }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Too many attempts. Please try again in 2 minutes.",
    );
    expect(screen.getByText("Send again in 2:00")).toBeInTheDocument();
  });
});

describe("EmailPromptView: the states the Design Lab draws", () => {
  const base = {
    mode: "prompt" as const,
    value: "",
    onValueChange: vi.fn(),
    sentTo: "",
    problem: null,
    failure: null,
    busy: false,
    waitSeconds: 0,
    resent: false,
    onSubmit: vi.fn(),
    onLater: vi.fn(),
    onResend: vi.fn(),
  };

  it("disables the field and shows Sending link while a request is on its way", () => {
    renderWithMessages(<EmailPromptView {...base} busy />);
    expect(screen.getByLabelText(authWords.label)).toBeDisabled();
    expect(screen.getByRole("button", { name: words.sending })).toBeDisabled();
  });

  it("shows the reminder's button as busy-disabled while sending again", () => {
    renderWithMessages(<EmailPromptView {...base} mode="pending" sentTo="a@b.co" busy />);
    expect(screen.getByRole("button", { name: authWords.resend })).toBeDisabled();
  });
});
