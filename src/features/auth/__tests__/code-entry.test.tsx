// @vitest-environment jsdom
import { act, configure, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { sendPhoneCode, verifyPhoneCode } from "../actions";
import { CodeEntry } from "../code-entry.client";
import { goTo } from "../navigate";

// The actions reach the server, the widget reaches Cloudflare and goTo leaves the page; the tests
// stand in for all three.
vi.mock("../actions", () => ({ sendPhoneCode: vi.fn(), verifyPhoneCode: vi.fn() }));
vi.mock("../navigate", () => ({ goTo: vi.fn() }));
const check = vi.hoisted(() => ({
  status: "verified" as "checking" | "verified" | "failed",
  mounts: 0,
}));
vi.mock("../human-check.client", async () => {
  const { useEffect } = await import("react");
  return {
    HumanCheck: ({
      onChange,
    }: {
      onChange: (status: string, token: string | null) => void;
      quiet?: boolean;
    }) => {
      useEffect(() => {
        check.mounts += 1;
        onChange(check.status, check.status === "verified" ? "token-1" : null);
      }, [onChange]);
      return null;
    },
  };
});

const words = en.auth.code;
const phoneWords = en.auth.phone;
const verify = vi.mocked(verifyPhoneCode);
const resendAction = vi.mocked(sendPhoneCode);
const go = vi.mocked(goTo);
const onChangeNumber = vi.fn();

const field = () => screen.getByLabelText(words.label);
const verifyButton = () => screen.getByRole("button", { name: words.verify });

function answerVerify(result: ActionResult<{ signedIn: true }>) {
  verify.mockResolvedValueOnce(result);
}
function answerResend(result: ActionResult<{ resendAfter: number }>) {
  resendAction.mockResolvedValueOnce(result);
}

function renderCode(options: { redirectTo?: string } = {}) {
  return renderWithMessages(
    <CodeEntry
      phone="+919876543210"
      sentAt={Date.now()}
      resendAfter={60}
      siteKey="site-key"
      redirectTo={options.redirectTo ?? "/dashboard"}
      onChangeNumber={onChangeNumber}
    />,
  );
}

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

function pass(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

// The clock here is partly fake, so a loaded machine needs more than the default second to settle.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  check.status = "verified";
  check.mounts = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("code entry: the default state (ADD-02)", () => {
  it("shows the title, the masked number, one labelled field, the hint and the tip", () => {
    renderCode();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByText("+91 98••• ••210")).toBeInTheDocument();
    expect(field()).toHaveAttribute("autocomplete", "one-time-code");
    expect(field()).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText(words.hint)).toBeInTheDocument();
    expect(screen.getByText(words.tip)).toBeInTheDocument();
    expect(verifyButton()).toBeDisabled();
  });

  it("never shows the whole number", () => {
    renderCode();
    expect(document.body.textContent).not.toContain("9876543210");
  });

  it("changes the number from either link", async () => {
    renderCode();
    await user().click(screen.getByRole("button", { name: words.changeNumber }));
    await user().click(screen.getByRole("button", { name: words.differentNumber }));
    expect(onChangeNumber).toHaveBeenCalledTimes(2);
  });
});

describe("code entry: checking the code", () => {
  it("checks the code itself on the sixth digit, with the number it was sent to", async () => {
    answerVerify({ ok: true, data: { signedIn: true } });
    renderCode();
    await user().type(field(), "482916");
    expect(verify).toHaveBeenCalledWith({ phone: "+919876543210", code: "482916" });
    expect(await screen.findByText(words.successTitle)).toBeInTheDocument();
  });

  it("shows Verifying while it waits, and does not check twice", async () => {
    let finish: (result: ActionResult<{ signedIn: true }>) => void = () => undefined;
    verify.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderCode();
    await user().type(field(), "482916");
    expect(await screen.findByRole("button", { name: words.verifying })).toBeDisabled();
    expect(field()).toBeDisabled();
    expect(verify).toHaveBeenCalledOnce();
    await act(async () => finish({ ok: true, data: { signedIn: true } }));
  });

  it("takes the visitor on after a short pause, or at once with Continue", async () => {
    answerVerify({ ok: true, data: { signedIn: true } });
    renderCode({ redirectTo: "/properties/home-1" });
    await user().type(field(), "482916");
    await screen.findByText(words.successTitle);
    expect(screen.getByText(words.successBody)).toBeInTheDocument();
    // Let the effect that sets the redirect timer run, then move the clock past the pause.
    await act(async () => undefined);
    pass(2);
    expect(go).toHaveBeenCalledOnce();
    expect(go).toHaveBeenCalledWith("/properties/home-1");
  });

  it("goes at once when Continue is pressed", async () => {
    answerVerify({ ok: true, data: { signedIn: true } });
    renderCode();
    await user().type(field(), "482916");
    await user().click(await screen.findByRole("button", { name: words.continue }));
    expect(go).toHaveBeenCalledWith("/dashboard");
  });

  it("says the code is wrong, clears the field and keeps the visitor's place", async () => {
    answerVerify({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { code: [{ key: "validation.codeWrong" }] },
    });
    renderCode();
    await user().type(field(), "111111");
    expect(await screen.findByText(words.wrongTitle)).toBeInTheDocument();
    expect(screen.getByText(words.wrongBody)).toBeInTheDocument();
    expect(screen.queryByText(/attempts left/)).not.toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveValue(""));
    expect(field()).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("calls a refused code expired once five minutes have passed since it was asked for", async () => {
    answerVerify({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { code: [{ key: "validation.codeWrong" }] },
    });
    renderCode();
    pass(301);
    await user().type(field(), "482916");
    expect(await screen.findByText(words.expiredTitle)).toBeInTheDocument();
    expect(screen.getByText(words.expiredBody)).toBeInTheDocument();
    expect(screen.queryByText(words.wrongTitle)).not.toBeInTheDocument();
  });

  it("pauses entry with the wait time when too many codes were tried, and offers another number", async () => {
    answerVerify({ ok: false, code: "RATE_LIMITED", retryAfter: 2520 });
    renderCode();
    await user().type(field(), "111111");
    expect(await screen.findByText(words.lockedTitle)).toBeInTheDocument();
    expect(screen.getByText(/Try again in 42 minutes/)).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(await screen.findByRole("button", { name: words.verify })).toBeDisabled();
    await user().click(screen.getByRole("button", { name: words.useDifferentNumber }));
    expect(onChangeNumber).toHaveBeenCalledOnce();
  });

  it("says codes cannot be checked, without blaming the code, and lets the visitor try again", async () => {
    answerVerify({ ok: false, code: "UPSTREAM_FAILED" });
    renderCode();
    await user().type(field(), "482916");
    expect(await screen.findByText(words.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(words.unavailableBody)).toBeInTheDocument();
    await user().click(screen.getByRole("button", { name: words.tryAgain }));
    expect(screen.queryByText(words.unavailableTitle)).not.toBeInTheDocument();
  });
});

describe("code entry: asking for a new code", () => {
  it("counts down before offering it, and says so for screen readers at 30 and 10 seconds", () => {
    renderCode();
    expect(screen.getByText("Resend code in 1:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: words.resend })).not.toBeInTheDocument();
    pass(30);
    expect(screen.getByText("Resend code in 0:30")).toBeInTheDocument();
    expect(screen.getByText("You can ask for a new code in 30 seconds.")).toBeInTheDocument();
    pass(20);
    expect(screen.getByText("You can ask for a new code in 10 seconds.")).toBeInTheDocument();
    pass(10);
    expect(screen.getByText(words.resendReady)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.resend })).toBeEnabled();
  });

  it("sends a new code with a fresh human-check token, then starts the countdown again", async () => {
    answerResend({ ok: true, data: { resendAfter: 60 } });
    renderCode();
    pass(61);
    const before = check.mounts;
    await user().click(screen.getByRole("button", { name: words.resend }));
    expect(resendAction).toHaveBeenCalledWith({ phone: "+919876543210", captchaToken: "token-1" });
    expect(await screen.findByText(words.resentTitle)).toBeInTheDocument();
    expect(screen.getByText(words.resentBody)).toBeInTheDocument();
    expect(screen.getByText(/Resend code in 1:0\d|Resend code in 0:5\d/)).toBeInTheDocument();
    expect(check.mounts).toBeGreaterThan(before);
  });

  it("keeps Resend off while the human check has not passed", () => {
    check.status = "checking";
    renderCode();
    pass(61);
    expect(screen.getByRole("button", { name: words.resend })).toBeDisabled();
  });

  it("shows how long to wait when too many codes were asked for, and counts that wait down", async () => {
    answerResend({ ok: false, code: "RATE_LIMITED", retryAfter: 840 });
    renderCode();
    pass(61);
    await user().click(screen.getByRole("button", { name: words.resend }));
    expect(await screen.findByText(words.blockedTitle)).toBeInTheDocument();
    expect(screen.getByText(/Please wait 14 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/Try again in 1[34]:\d\d/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: words.resend })).not.toBeInTheDocument();
  });

  it("says codes cannot be sent when the service is down", async () => {
    answerResend({ ok: false, code: "UPSTREAM_FAILED" });
    renderCode();
    pass(61);
    await user().click(screen.getByRole("button", { name: words.resend }));
    expect(await screen.findByText(phoneWords.unavailableTitle)).toBeInTheDocument();
  });

  it("shows the human-check message when the server refuses the token", async () => {
    answerResend({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] },
    });
    renderCode();
    pass(61);
    await user().click(screen.getByRole("button", { name: words.resend }));
    expect(await screen.findByText(phoneWords.captchaFailedTitle)).toBeInTheDocument();
  });
});
