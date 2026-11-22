// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";

vi.mock("server-only", () => ({}));
const getSessionView = vi.fn();
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView }));

const { LoginWallScreen } = await import("../login-wall-screen");
const { isSignedOut, loginWallHref } = await import("../gate");
const { MOCK_HOMES, MOCK_PROJECTS } = await import("../mock-data");

const words = en.loginWall;

beforeEach(() => vi.clearAllMocks());

describe("UT-login-wall-gate: who sees the list (ADR-171)", () => {
  it("sends a visitor who is not signed in to the phone sign-in, with the way back to the same page", async () => {
    getSessionView.mockResolvedValue(null);
    expect(await loginWallHref("/properties?listingType=sale&bhk=3")).toBe(
      `/auth?redirect=${encodeURIComponent("/properties?listingType=sale&bhk=3")}`,
    );
    expect(await isSignedOut()).toBe(true);
  });

  it("lets a signed-in visitor through: no wall", async () => {
    getSessionView.mockResolvedValue({ userId: "u1", roles: [], builderId: null });
    expect(await loginWallHref("/properties")).toBeNull();
    expect(await isSignedOut()).toBe(false);
  });

  it("never sends the visitor to an address outside this site", async () => {
    getSessionView.mockResolvedValue(null);
    const href = await loginWallHref("https://elsewhere.example/steal");
    expect(href).not.toContain("elsewhere.example");
  });
});

describe("UT-login-wall-screen: what a visitor who is not signed in sees", () => {
  it("shows the message and one button to the sign-in, for each of the three pages", () => {
    for (const kind of ["properties", "projects", "compare"] as const) {
      const { unmount } = renderWithMessages(
        <LoginWallScreen kind={kind} signInHref="/auth?redirect=%2Fprojects" />,
      );
      expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
      expect(screen.getByText(words.body)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: words.button })).toHaveAttribute(
        "href",
        "/auth?redirect=%2Fprojects",
      );
      unmount();
    }
  });

  it("draws made-up cards that nobody can reach: hidden, inert, and not even a link in the page", () => {
    const { container } = renderWithMessages(
      <LoginWallScreen kind="properties" signInHref="/auth" />,
    );
    const mock = container.querySelector('[data-slot="login-wall-mock"]');
    expect(mock).toHaveAttribute("aria-hidden", "true");
    expect(mock).toHaveAttribute("inert");
    // Only the one sign-in link can be reached by a person or a screen reader.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("draws two homes for the comparison and six for the lists", () => {
    const compare = renderWithMessages(<LoginWallScreen kind="compare" signInHref="/auth" />);
    expect(compare.container.querySelectorAll('[data-slot="login-wall-mock"] article').length).toBe(
      2,
    );
    compare.unmount();
    const homes = renderWithMessages(<LoginWallScreen kind="properties" signInHref="/auth" />);
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
      <LoginWallScreen kind="projects" signInHref="/auth" />,
    );
    const text = container.querySelector('[data-slot="login-wall-mock"]')?.textContent ?? "";
    expect(text).toContain("Sample project 1");
    expect(text).toContain(en.loginWall.mock.locality);
  });
});
