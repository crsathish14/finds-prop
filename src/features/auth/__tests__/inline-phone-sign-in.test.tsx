// @vitest-environment jsdom
import { act, configure, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { sendPhoneCode, verifyPhoneCode } from "../actions";
import { InlinePhoneSignIn } from "../inline-phone-sign-in.client";
import { goTo } from "../navigate";

// UT-auth-inline (login wall, ADR-171): the phone sign-in inside another page's card. The same number step, code step,
// actions and words as /auth, with no frame, no page links, no h1 and no navigation; once the code is right the page
// refreshes in place. The actions reach the server, the widget reaches Cloudflare and goTo leaves the page; the tests
// stand in for all three.
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../navigate", () => ({ goTo: vi.fn() }));
vi.mock("../actions", () => ({
  sendPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
  saveProfileName: vi.fn(),
  addEmail: vi.fn(),
  resendEmailLink: vi.fn(),
}));
vi.mock("../human-check.client", async () => {
  const { useEffect } = await import("react");
  return {
    HumanCheck: ({ onChange }: { onChange: (status: string, token: string | null) => void }) => {
      useEffect(() => {
        onChange("verified", "token-1");
      }, [onChange]);
      return null;
    },
  };
});

const words = en.auth.phone;
const codeWords = en.auth.code;
const send = vi.mocked(sendPhoneCode);
const verify = vi.mocked(verifyPhoneCode);
const go = vi.mocked(goTo);

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

function answerSend(result: ActionResult<{ resendAfter: number }>) {
  send.mockResolvedValueOnce(result);
}
function answerVerify(result: ActionResult<{ signedIn: true; needsName: boolean }>) {
  verify.mockResolvedValueOnce(result);
}

async function sendTheCode() {
  answerSend({ ok: true, data: { resendAfter: 60 } });
  await user().type(screen.getByLabelText(words.label), "98765 43210");
  await user().click(screen.getByRole("button", { name: new RegExp(`^${words.send}$`) }));
  return screen.findByLabelText(codeWords.label);
}

describe("UT-auth-inline: the number step inside a card", () => {
  it("has the number field, the check and Send code, and the consent line", () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    expect(screen.getByLabelText(words.label)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`^${words.send}$`) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.termsLink })).toHaveAttribute("href", "/terms");
  });

  it("has no page heading, no builder link and no back link: the page around it has its own", () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("link", { name: words.builderLink })).toBeNull();
    expect(screen.queryByRole("link", { name: words.backLink })).toBeNull();
  });
});

describe("UT-auth-inline: the code step and what follows", () => {
  it("asks for the code in the same card, under an h2, and sends the number the actions need", async () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    await sendTheCode();
    expect(send).toHaveBeenCalledWith({ phone: "98765 43210", captchaToken: "token-1" });
    expect(screen.getByRole("heading", { level: 2, name: codeWords.title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("stays on the page after a right code: it refreshes in place and goes nowhere", async () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    const field = await sendTheCode();
    answerVerify({ ok: true, data: { signedIn: true, needsName: false } });
    await user().type(field, "482916");
    expect(verify).toHaveBeenCalledWith({ phone: "+919876543210", code: "482916" });
    expect(await screen.findByText(codeWords.successTitle)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });

  it("lets a new account straight in too: the name is asked for before posting, not here", async () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    const field = await sendTheCode();
    answerVerify({ ok: true, data: { signedIn: true, needsName: true } });
    await user().type(field, "482916");
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText(en.auth.name.label)).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it("keeps a wrong code in the card, with the same words as the sign-in page", async () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    const field = await sendTheCode();
    verify.mockResolvedValueOnce({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { code: [{ key: "validation.codeWrong" }] },
    } as ActionResult<{ signedIn: true; needsName: boolean }>);
    await user().type(field, "000000");
    expect(await screen.findByText(codeWords.wrongTitle)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("says the same thing as /auth when too many codes were asked for", async () => {
    renderWithMessages(<InlinePhoneSignIn siteKey="site-key" />);
    send.mockResolvedValueOnce({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    } as ActionResult<{ resendAfter: number }>);
    await user().type(screen.getByLabelText(words.label), "98765 43210");
    await user().click(screen.getByRole("button", { name: new RegExp(`^${words.send}$`) }));
    expect(await screen.findByText(words.rateLimitedTitle)).toBeInTheDocument();
  });
});
