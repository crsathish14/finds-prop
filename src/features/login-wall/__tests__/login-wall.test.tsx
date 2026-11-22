// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";

vi.mock("server-only", () => ({}));
const getSessionView = vi.fn();
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView }));
// The phone sign-in is the auth feature's own island (tested there); here it is a stand-in that shows its site key.
vi.mock("@/features/auth", () => ({
  InlinePhoneSignIn: ({ siteKey }: { siteKey: string | undefined }) => (
    <div data-testid="inline-sign-in" data-site-key={siteKey ?? ""} />
  ),
}));

const { LoginWallScreen } = await import("../login-wall-screen");
const { isSignedOut } = await import("../gate");
const { MOCK_HOMES, MOCK_PROJECTS } = await import("../mock-data");

const words = en.loginWall;

beforeEach(() => vi.clearAllMocks());

describe("UT-login-wall-gate: who sees the list (ADR-171)", () => {
  it("says a visitor who is not signed in is signed out", async () => {
    getSessionView.mockResolvedValue(null);
    expect(await isSignedOut()).toBe(true);
  });

  it("lets a signed-in visitor through: no wall", async () => {
    getSessionView.mockResolvedValue({ userId: "u1", roles: [], builderId: null });
    expect(await isSignedOut()).toBe(false);
  });
});

describe("UT-login-wall-screen: what a visitor who is not signed in sees", () => {
  it("shows the message and the phone sign-in inside the card, for each of the three pages", () => {
    for (const kind of ["properties", "projects", "compare"] as const) {
      const { unmount } = renderWithMessages(<LoginWallScreen kind={kind} siteKey="site-key" />);
      expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
      expect(screen.getByText(words.body)).toBeInTheDocument();
      const signIn = screen.getByTestId("inline-sign-in");
      expect(signIn).toHaveAttribute("data-site-key", "site-key");
      expect(signIn.closest('[data-slot="login-wall-panel"]')).not.toBeNull();
      unmount();
    }
  });

  it("sends the visitor nowhere: no link to the sign-in page, and the cards cannot be reached", () => {
    const { container } = renderWithMessages(
      <LoginWallScreen kind="properties" siteKey="site-key" />,
    );
    const mock = container.querySelector('[data-slot="login-wall-mock"]');
    expect(mock).toHaveAttribute("aria-hidden", "true");
    expect(mock).toHaveAttribute("inert");
    // The stand-in for the sign-in draws no link, and nothing in the screen leads to /auth.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(container.querySelector('a[href^="/auth"]')).toBeNull();
  });

  it("draws two homes for the comparison and six for the lists", () => {
    const compare = renderWithMessages(<LoginWallScreen kind="compare" siteKey={undefined} />);
    expect(compare.container.querySelectorAll('[data-slot="login-wall-mock"] article').length).toBe(
      2,
    );
    compare.unmount();
    const homes = renderWithMessages(<LoginWallScreen kind="properties" siteKey={undefined} />);
    expect(homes.container.querySelectorAll('[data-slot="login-wall-mock"] article').length).toBe(
      6,
    );
  });
});

describe("UT-login-wall-mock: nothing real is drawn", () => {
  it("holds invented numbers and pictures from the Design Lab only", () => {
    expect(MOCK_HOMES).toHaveLength(6);
    expect(MOCK_PROJECTS).toHaveLength(6);
    for (const card of [...MOCK_HOMES, ...MOCK_PROJECTS]) {
      expect(card.cover.startsWith("/design-lab/")).toBe(true);
    }
  });

  it("writes every word on the cards from en.json, as sample text", () => {
    const { container } = renderWithMessages(
      <LoginWallScreen kind="projects" siteKey="site-key" />,
    );
    const text = container.querySelector('[data-slot="login-wall-mock"]')?.textContent ?? "";
    expect(text).toContain("Sample project 1");
    expect(text).toContain(en.loginWall.mock.locality);
  });
});
