// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { EmailResultScreen } from "../email-result.client";
import { goTo } from "../navigate";

// The actions reach the server and goTo leaves the page; the tests stand in for both.
vi.mock("../actions", () => ({ addEmail: vi.fn(), resendEmailLink: vi.fn() }));
vi.mock("../navigate", () => ({ goTo: vi.fn() }));

const words = en.auth.email;
const go = vi.mocked(goTo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("email result: the link worked (ADD-03 verified)", () => {
  it("thanks the visitor, names the confirmed address and says what it allows", () => {
    renderWithMessages(
      <EmailResultScreen result="verified" email="priya.raman@example.com" signedIn />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: words.verifiedTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText("priya.raman@example.com")).toBeInTheDocument();
    expect(document.body.textContent).toContain("is confirmed. You can post a property");
  });

  it("offers to carry on posting, or to go to the dashboard", async () => {
    renderWithMessages(<EmailResultScreen result="verified" email="a@example.com" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: words.continuePost }));
    expect(go).toHaveBeenLastCalledWith("/post-property");
    await userEvent.click(screen.getByRole("button", { name: words.dashboard }));
    expect(go).toHaveBeenLastCalledWith("/dashboard");
  });

  it("shows the panel beside the card for the email step", () => {
    renderWithMessages(<EmailResultScreen result="verified" email="a@example.com" signedIn />);
    expect(screen.getByText(words.benefitUpdates)).toBeInTheDocument();
  });
});

describe("email result: the link did not work (ADD-03 expired)", () => {
  it("says the link has expired or was used, and that links work once and for a short time", () => {
    renderWithMessages(<EmailResultScreen result="expired" email={null} signedIn />);
    expect(screen.getByRole("heading", { level: 1, name: words.expiredTitle })).toBeInTheDocument();
    expect(screen.getByText(words.expiredBody)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: words.continuePost })).not.toBeInTheDocument();
  });

  it("lets a signed-in visitor ask for a new link on the same card", async () => {
    renderWithMessages(<EmailResultScreen result="expired" email={null} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: words.newLink }));
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(words.label))).toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
  });

  it("sends a visitor with no session to sign in first, rather than asking for a link", async () => {
    renderWithMessages(<EmailResultScreen result="expired" email={null} signedIn={false} />);
    await userEvent.click(screen.getByRole("button", { name: words.newLink }));
    expect(go).toHaveBeenCalledWith("/auth");
    expect(screen.queryByLabelText(new RegExp(words.label))).not.toBeInTheDocument();
  });

  it("offers the dashboard", async () => {
    renderWithMessages(<EmailResultScreen result="expired" email={null} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: words.dashboard }));
    expect(go).toHaveBeenCalledWith("/dashboard");
  });
});
