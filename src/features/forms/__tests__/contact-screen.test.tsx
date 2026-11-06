// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ContactConsent, ContactScreen, type ReachLine } from "../contact-screen";
import { ContactLoadFailed, ContactSent } from "../contact-states";

const words = messages.contact;

const CONTACTS: ReachLine[] = [
  { kind: "phone", text: "+91 90000 00000", href: "tel:+919000000000" },
  { kind: "email", text: "hello@findprop.example", href: "mailto:hello@findprop.example" },
  { kind: "address", text: "Chennai, Tamil Nadu" },
];

describe("ContactScreen: the page around the form (S5-T05)", () => {
  it("has the title and lead, the form's card and the breadcrumb", () => {
    renderWithMessages(
      <ContactScreen contacts={[]}>
        <p>the form</p>
      </ContactScreen>,
    );
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByText(words.lead)).toBeVisible();
    expect(screen.getByText("the form")).toBeVisible();
    expect(screen.getByRole("navigation", { name: words.crumb.nav })).toBeVisible();
  });

  it("shows the contact details that are set, as links where they can be one, and labels each", () => {
    renderWithMessages(
      <ContactScreen contacts={CONTACTS}>
        <p>the form</p>
      </ContactScreen>,
    );
    const side = screen.getByRole("complementary", { name: words.reach.label });
    expect(within(side).getByRole("heading", { name: words.reach.heading })).toBeVisible();
    expect(within(side).getByRole("link", { name: "+91 90000 00000" })).toHaveAttribute(
      "href",
      "tel:+919000000000",
    );
    expect(within(side).getByRole("link", { name: "hello@findprop.example" })).toHaveAttribute(
      "href",
      "mailto:hello@findprop.example",
    );
    expect(within(side).getByText("Chennai, Tamil Nadu")).toBeVisible();
    expect(within(side).getByText(words.reach.address)).toBeVisible();
  });

  it("leaves the column out when no contact detail is set", () => {
    renderWithMessages(
      <ContactScreen contacts={[]}>
        <p>the form</p>
      </ContactScreen>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText(words.reach.heading)).not.toBeInTheDocument();
  });

  it("shows only the lines that are set", () => {
    renderWithMessages(
      <ContactScreen contacts={[CONTACTS[1] as ReachLine]}>
        <p>the form</p>
      </ContactScreen>,
    );
    expect(screen.getByText(words.reach.email)).toBeVisible();
    expect(screen.queryByText(words.reach.phone)).not.toBeInTheDocument();
    expect(screen.queryByText(words.reach.address)).not.toBeInTheDocument();
  });

  it("links the consent line to the Privacy Policy", () => {
    renderWithMessages(<ContactConsent />);
    expect(screen.getByText(new RegExp(words.consent.text))).toBeVisible();
    expect(screen.getByRole("link", { name: words.consent.privacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});

describe("the notices that take the form's place (S5-T05)", () => {
  it("confirms a message with the standard words and a way back home", () => {
    renderWithMessages(<ContactSent />);
    expect(screen.getByRole("status")).toHaveTextContent(words.sent.title);
    expect(screen.getByText(words.sent.body)).toBeVisible();
    expect(screen.getByRole("link", { name: words.sent.backHome })).toHaveAttribute("href", "/");
  });

  it("uses the form's own success text when it has one", () => {
    renderWithMessages(<ContactSent message="Thanks, we will call you." />);
    expect(screen.getByText("Thanks, we will call you.")).toBeVisible();
    expect(screen.queryByText(words.sent.body)).not.toBeInTheDocument();
  });

  it("says the form could not load, points to the details beside it only when there are some", () => {
    const { unmount } = renderWithMessages(
      <ContactLoadFailed
        hasContacts
        action={<button type="button">{words.loadFailed.refresh}</button>}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(words.loadFailed.title);
    expect(screen.getByText(words.loadFailed.body)).toBeVisible();
    expect(screen.getByRole("button", { name: words.loadFailed.refresh })).toBeVisible();
    unmount();
    renderWithMessages(<ContactLoadFailed hasContacts={false} action={null} />);
    expect(screen.getByText(words.loadFailed.bodyAlone)).toBeVisible();
  });
});
