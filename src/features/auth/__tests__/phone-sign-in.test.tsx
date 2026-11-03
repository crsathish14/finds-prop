// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { sendPhoneCode, verifyPhoneCode } from "../actions";
import { PhoneSignInScreen } from "../phone-sign-in-screen";

// The action reaches the server and the widget reaches Cloudflare; the tests stand in for both.
vi.mock("../actions", () => ({ sendPhoneCode: vi.fn(), verifyPhoneCode: vi.fn() }));
const check = vi.hoisted(() => ({
  status: "verified" as "checking" | "verified" | "failed",
  token: "token-1" as string | null,
  mounts: 0,
}));
vi.mock("../human-check.client", async () => {
  const { useEffect } = await import("react");
  return {
    HumanCheck: ({
      onChange,
      onRetry,
    }: {
      onChange: (status: string, token: string | null) => void;
      onRetry: () => void;
    }) => {
      useEffect(() => {
        check.mounts += 1;
        onChange(check.status, check.status === "verified" ? check.token : null);
      }, [onChange]);
      return (
        <button type="button" onClick={onRetry}>
          retry the check
        </button>
      );
    },
  };
});

const words = en.auth.phone;
const codeWords = en.auth.code;
const send = vi.mocked(sendPhoneCode);
const sendButton = () => screen.getByRole("button", { name: new RegExp(`^${words.send}$`) });
const field = () => screen.getByLabelText(words.label);

function answer(result: ActionResult<{ resendAfter: number }>) {
  send.mockResolvedValueOnce(result);
}

function renderScreen(gate = false) {
  return renderWithMessages(
    <PhoneSignInScreen siteKey="site-key" gate={gate} redirectTo="/dashboard" />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  check.status = "verified";
  check.token = "token-1";
  check.mounts = 0;
});

describe("phone sign-in: the default state (ADD-01)", () => {
  it("shows the title, the number field with its hint, and a Send code button", () => {
    renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByText(words.lead)).toBeInTheDocument();
    expect(field()).toHaveAttribute("type", "tel");
    expect(field()).toHaveAttribute("autocomplete", "tel-national");
    expect(screen.getByText(words.hint)).toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it("has no Google and no password option for customers", () => {
    renderScreen();
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("links the terms, the privacy policy, the builder sign-in and the home page", () => {
    renderScreen();
    expect(screen.getByRole("link", { name: words.termsLink })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: words.privacyLink })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: words.builderLink })).toHaveAttribute(
      "href",
      "/builder/login",
    );
    expect(screen.getByRole("link", { name: words.backLink })).toHaveAttribute("href", "/");
  });

  it("shows the benefits beside the card", () => {
    renderScreen();
    for (const text of [
      words.benefitShortlist,
      words.benefitCompare,
      words.benefitEnquire,
      words.benefitPost,
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("does not show the sign-in-required message unless the visitor was sent here", () => {
    renderScreen();
    expect(screen.queryByText(words.gateTitle)).not.toBeInTheDocument();
  });
});

describe("phone sign-in: the gate state", () => {
  it("says why the visitor is here and where they will go back to", () => {
    renderScreen(true);
    expect(screen.getByText(words.gateTitle)).toBeInTheDocument();
    expect(screen.getByText(words.gateBody)).toBeInTheDocument();
  });
});

describe("phone sign-in: the human check", () => {
  it("keeps Send code off while the check is running", () => {
    check.status = "checking";
    renderScreen();
    expect(sendButton()).toBeDisabled();
    expect(screen.queryByText(words.captchaFailedTitle)).not.toBeInTheDocument();
  });

  it("says so, and keeps Send code off, when the check failed", () => {
    check.status = "failed";
    renderScreen();
    expect(screen.getByText(words.captchaFailedTitle)).toBeInTheDocument();
    expect(screen.getByText(words.captchaFailedBody)).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it("starts a new check when the visitor asks for one", async () => {
    renderScreen();
    const before = check.mounts;
    await userEvent.click(screen.getByRole("button", { name: "retry the check" }));
    await waitFor(() => expect(check.mounts).toBe(before + 1));
  });
});

describe("phone sign-in: the number", () => {
  it("shows the invalid-number message for a number that is too short, and asks nothing of the server", async () => {
    renderScreen();
    await userEvent.type(field(), "98765 4321");
    await userEvent.click(sendButton());
    expect(screen.getByText(en.validation.phoneInvalid)).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(send).not.toHaveBeenCalled();
  });

  it("clears the message as soon as the visitor edits the number", async () => {
    renderScreen();
    await userEvent.type(field(), "123");
    await userEvent.click(sendButton());
    await userEvent.type(field(), "4");
    expect(screen.queryByText(en.validation.phoneInvalid)).not.toBeInTheDocument();
  });

  it("shows the other country's code and the +91-only message for a foreign number", async () => {
    renderScreen();
    await userEvent.type(field(), "+44 7700 900123");
    await userEvent.click(sendButton());
    expect(screen.getByText(en.validation.phoneUnsupported)).toBeInTheDocument();
    expect(screen.getByText("+44")).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("phone sign-in: a new account", () => {
  it("asks for the visitor's name after the code is checked, on a card with no side panel", async () => {
    answer({ ok: true, data: { resendAfter: 60 } });
    vi.mocked(verifyPhoneCode).mockResolvedValueOnce({
      ok: true,
      data: { signedIn: true, needsName: true },
    });
    renderScreen();
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    await userEvent.type(await screen.findByLabelText(codeWords.label), "482916");
    expect(
      await screen.findByRole("heading", { level: 1, name: en.auth.name.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(codeWords.benefitPrivate)).not.toBeInTheDocument();
    expect(screen.queryByText(words.benefitShortlist)).not.toBeInTheDocument();
  });
});

describe("phone sign-in: sending the code", () => {
  it("sends the number as typed with the token, then moves to the code step with a masked number", async () => {
    answer({ ok: true, data: { resendAfter: 60 } });
    renderScreen();
    await userEvent.type(field(), "98765 43210");
    await userEvent.click(sendButton());
    expect(send).toHaveBeenCalledWith({ phone: "98765 43210", captchaToken: "token-1" });
    expect(await screen.findByRole("heading", { level: 1, name: codeWords.title })).toBeVisible();
    expect(screen.getByText("+91 98••• ••210")).toBeVisible();
    expect(screen.queryByText(/9876543210/)).not.toBeInTheDocument();
  });

  it("returns to the number form from the code step", async () => {
    answer({ ok: true, data: { resendAfter: 60 } });
    renderScreen();
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    await userEvent.click(await screen.findByRole("button", { name: codeWords.changeNumber }));
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
  });

  it("starts a new human check after every request, because a token works once", async () => {
    answer({ ok: true, data: { resendAfter: 60 } });
    renderScreen();
    const before = check.mounts;
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    await userEvent.click(await screen.findByRole("button", { name: codeWords.changeNumber }));
    expect(check.mounts).toBeGreaterThan(before);
  });

  it("starts a new check when sending fails, so the next try has a fresh token", async () => {
    answer({ ok: false, code: "UPSTREAM_FAILED" });
    renderScreen();
    const before = check.mounts;
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    await screen.findByText(words.unavailableTitle);
    expect(check.mounts).toBeGreaterThan(before);
  });

  it("shows how long to wait when the limit is reached, and keeps Send code off", async () => {
    answer({ ok: false, code: "RATE_LIMITED", retryAfter: 840 });
    renderScreen();
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    expect(await screen.findByText(words.rateLimitedTitle)).toBeInTheDocument();
    expect(screen.getByText(/try again in 14 minutes/)).toBeInTheDocument();
    await waitFor(() => expect(sendButton()).toBeDisabled());
  });

  it("says the service is down, without blaming the number, and lets the visitor try again", async () => {
    answer({ ok: false, code: "UPSTREAM_FAILED" });
    renderScreen();
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    expect(await screen.findByText(words.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(words.unavailableBody)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.tryAgain }));
    expect(screen.queryByText(words.unavailableTitle)).not.toBeInTheDocument();
    expect(field()).toHaveValue("9876543210");
  });

  it("shows the human-check message when the server refuses the token", async () => {
    answer({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] },
    });
    renderScreen();
    await userEvent.type(field(), "9876543210");
    check.status = "checking"; // the new check the refusal starts has not finished yet
    await userEvent.click(sendButton());
    expect(await screen.findByText(words.captchaFailedTitle)).toBeInTheDocument();
    await waitFor(() => expect(sendButton()).toBeDisabled());
  });

  it("shows the server's verdict on the number when it differs from the quick check", async () => {
    answer({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { phone: [{ key: "validation.phoneUnsupported" }] },
    });
    renderScreen();
    await userEvent.type(field(), "9876543210");
    await userEvent.click(sendButton());
    expect(await screen.findByText(en.validation.phoneUnsupported)).toBeInTheDocument();
  });

  it("keeps what the visitor typed when sending fails", async () => {
    answer({ ok: false, code: "INTERNAL", requestId: "req-1" });
    renderScreen();
    await userEvent.type(field(), "98765 43210");
    await userEvent.click(sendButton());
    await screen.findByText(words.unavailableTitle);
    expect(field()).toHaveValue("98765 43210");
  });
});
