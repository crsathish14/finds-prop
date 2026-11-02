// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { startStaffGoogleSignIn } from "../actions";
import { goTo } from "../navigate";
import { StaffSignInScreen } from "../staff-sign-in-screen";

// The action reaches the server; the tests stand in for it, and for the browser's navigation.
vi.mock("../actions", () => ({ startStaffGoogleSignIn: vi.fn() }));
vi.mock("../navigate", () => ({ goTo: vi.fn() }));

const words = en.auth.staff;
const start = vi.mocked(startStaffGoogleSignIn);
const google = () => screen.getByRole("button", { name: new RegExp(words.google) });

function answer(result: ActionResult<{ url: string }>) {
  start.mockResolvedValueOnce(result);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("staff sign-in: the builder and agent screen (ADD-05, Google only)", () => {
  it("shows one Google button and no password, reset or second step", () => {
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    expect(
      screen.getByRole("heading", { level: 1, name: words.builder.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(words.builder.lead)).toBeInTheDocument();
    expect(google()).toBeEnabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot|reset|second step|authenticator/i)).not.toBeInTheDocument();
  });

  it("says accounts are by invitation only and links to the customer sign-in", () => {
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    expect(screen.getByText(words.builder.invitationOnly)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.builder.buyerLink })).toHaveAttribute(
      "href",
      "/auth",
    );
  });

  it("shows the portal benefits beside the card", () => {
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    for (const benefit of [
      words.builder.benefitPublish,
      words.builder.benefitUnits,
      words.builder.benefitLeads,
      words.builder.benefitInsights,
    ]) {
      expect(screen.getByText(benefit)).toBeInTheDocument();
    }
    expect(screen.getByText(words.builder.asideEmphasis).tagName).toBe("EM");
  });

  it("shows no message when nothing went wrong", () => {
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["denied", "alert", words.builder.deniedTitle, words.builder.deniedBody],
    ["cancelled", "status", words.cancelledTitle, words.cancelledBody],
    ["error", "alert", words.errorTitle, words.errorBody],
  ] as const)("shows the %s state", (problem, role, title, body) => {
    renderWithMessages(<StaffSignInScreen area="builder" problem={problem} />);
    const message = screen
      .getAllByRole(role)
      .find((element) => element.textContent?.includes(title));
    expect(message).toBeDefined();
    expect(within(message as HTMLElement).getByText(body)).toBeInTheDocument();
    expect(google()).toBeEnabled();
  });

  it("never names an address or a reason in the denied message", () => {
    renderWithMessages(<StaffSignInScreen area="builder" problem="denied" />);
    const text = screen.getByText(words.builder.deniedTitle).closest("[role=alert]")?.textContent;
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/invited (to|as)|deactivated|inactive/i);
  });
});

describe("staff sign-in: the administrator screen (ADD-06, Google only)", () => {
  it("shows one Google button, a way back to the public site and the quiet note", () => {
    renderWithMessages(<StaffSignInScreen area="admin" problem={null} />);
    expect(screen.getByRole("heading", { level: 1, name: words.admin.title })).toBeInTheDocument();
    expect(screen.getByText(words.admin.lead)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("link", { name: words.admin.backLink })).toHaveAttribute("href", "/");
    expect(screen.getByText(words.admin.quietNote)).toBeInTheDocument();
    expect(screen.queryByText(words.builder.buyerLink)).not.toBeInTheDocument();
  });

  it("shows the not-authorised state for a refused account", () => {
    renderWithMessages(<StaffSignInScreen area="admin" problem="denied" />);
    expect(screen.getByText(words.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText(words.admin.deniedBody)).toBeInTheDocument();
  });

  it("shows the cancelled and error states", () => {
    const { unmount } = renderWithMessages(<StaffSignInScreen area="admin" problem="cancelled" />);
    expect(screen.getByText(words.cancelledTitle)).toBeInTheDocument();
    unmount();
    renderWithMessages(<StaffSignInScreen area="admin" problem="error" />);
    expect(screen.getByText(words.errorTitle)).toBeInTheDocument();
  });
});

describe("staff sign-in: the Google button", () => {
  it("asks the server for the Google address for its own area, then goes there", async () => {
    answer({ ok: true, data: { url: "https://abcdefghij.supabase.co/auth/v1/authorize?x=1" } });
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    await userEvent.click(google());
    await waitFor(() => expect(goTo).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith({ area: "builder" });
    expect(goTo).toHaveBeenCalledWith("https://abcdefghij.supabase.co/auth/v1/authorize?x=1");
  });

  it("sends the administrator's area from the administrator page", async () => {
    answer({ ok: true, data: { url: "https://abcdefghij.supabase.co/auth/v1/authorize" } });
    renderWithMessages(<StaffSignInScreen area="admin" problem={null} />);
    await userEvent.click(google());
    await waitFor(() => expect(start).toHaveBeenCalledWith({ area: "admin" }));
  });

  it("stays busy, with the Opening Google label, until the browser has left", async () => {
    answer({ ok: true, data: { url: "https://abcdefghij.supabase.co/auth/v1/authorize" } });
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    await userEvent.click(google());
    const button = await screen.findByRole("button", { name: new RegExp(words.googleOpening) });
    expect(button).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(goTo).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: new RegExp(words.googleOpening) })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows the too-many-attempts state, with the wait, and disables the button", async () => {
    answer({ ok: false, code: "RATE_LIMITED", retryAfter: 600 });
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    await userEvent.click(google());
    expect(await screen.findByText(words.rateLimitedTitle)).toBeInTheDocument();
    expect(screen.getByText("For your security, try again in 10 minutes.")).toBeInTheDocument();
    expect(google()).toBeDisabled();
    expect(goTo).not.toHaveBeenCalled();
  });

  it("says one minute, not zero, for a very short wait", async () => {
    answer({ ok: false, code: "RATE_LIMITED", retryAfter: 20 });
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    await userEvent.click(google());
    expect(
      await screen.findByText("For your security, try again in 1 minute."),
    ).toBeInTheDocument();
  });

  it("shows the error state for any other failure and lets the visitor try again", async () => {
    answer({ ok: false, code: "UPSTREAM_FAILED" });
    renderWithMessages(<StaffSignInScreen area="builder" problem={null} />);
    await userEvent.click(google());
    expect(await screen.findByText(words.errorTitle)).toBeInTheDocument();
    expect(google()).toBeEnabled();
    expect(goTo).not.toHaveBeenCalled();
  });

  it("clears an earlier message when the visitor tries again", async () => {
    answer({ ok: true, data: { url: "https://abcdefghij.supabase.co/auth/v1/authorize" } });
    renderWithMessages(<StaffSignInScreen area="builder" problem="denied" />);
    expect(screen.getByText(words.builder.deniedTitle)).toBeInTheDocument();
    await userEvent.click(google());
    await waitFor(() =>
      expect(screen.queryByText(words.builder.deniedTitle)).not.toBeInTheDocument(),
    );
  });
});
