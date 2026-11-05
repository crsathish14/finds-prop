// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ProjectLeadCard } from "../project-lead-card.client";
import { ProjectMobileBar } from "../project-mobile-bar";

const words = en.projects.page.lead;

/** What the app layout provides, for a test that renders again with other props. */
const wrap = (ui: ReactElement) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const bar = en.projects.page;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}

describe("ProjectLeadCard: Interested in this project? (S4-T09)", () => {
  it("is the enquiry form with Enquire chosen, the required fields marked, and no date", () => {
    const { container } = renderWithMessages(<ProjectLeadCard state="form" />);
    expect(container.querySelector("#enquiry")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: words.title })).toBeInTheDocument();
    const kinds = screen.getByRole("radiogroup", { name: words.kindLabel });
    expect(within(kinds).getByRole("radio", { name: words.enquire })).toBeChecked();
    expect(screen.getByLabelText(new RegExp(`^${words.name}`))).toBeRequired();
    expect(screen.getByLabelText(new RegExp(`^${words.email}`))).toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(`^${words.visitDate}`))).toBeNull();
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
  });

  it("asks for a preferred date and offers to request a site visit when Site visit is chosen", () => {
    renderWithMessages(<ProjectLeadCard state="form" />);
    fireEvent.click(screen.getByRole("radio", { name: words.siteVisit }));
    expect(screen.getByLabelText(new RegExp(`^${words.visitDate}`))).toHaveAttribute(
      "type",
      "date",
    );
    expect(screen.getByRole("button", { name: words.requestVisit })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: words.send })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: words.enquire }));
    expect(screen.queryByLabelText(new RegExp(`^${words.visitDate}`))).toBeNull();
  });

  it("can start on Site visit", () => {
    renderWithMessages(<ProjectLeadCard state="form" defaultKind="site_visit" />);
    expect(screen.getByRole("radio", { name: words.siteVisit })).toBeChecked();
  });

  it("keeps what the visitor typed when the request type changes", () => {
    renderWithMessages(<ProjectLeadCard state="form" />);
    fill(words.name, "Priya Raman");
    fireEvent.click(screen.getByRole("radio", { name: words.siteVisit }));
    expect(screen.getByLabelText(new RegExp(`^${words.name}`))).toHaveValue("Priya Raman");
  });

  it("starts with the values it is given", () => {
    renderWithMessages(<ProjectLeadCard state="form" values={{ name: "Priya Raman" }} />);
    expect(screen.getByLabelText(new RegExp(`^${words.name}`))).toHaveValue("Priya Raman");
  });

  it("shows the account's phone, locked, and says where it comes from", () => {
    renderWithMessages(<ProjectLeadCard state="form" phone="+91 98••• ••345" />);
    const phone = screen.getByLabelText(new RegExp(`^${words.phone}`));
    expect(phone).toHaveValue("+91 98••• ••345");
    expect(phone).toHaveAttribute("readonly");
    expect(phone).not.toBeRequired();
    expect(phone).toHaveAccessibleDescription(words.phoneHint);
  });

  it("limits the visit date to the window it is given", () => {
    renderWithMessages(
      <ProjectLeadCard
        state="form"
        defaultKind="site_visit"
        visitDateMin="2026-11-06"
        visitDateMax="2027-11-06"
      />,
    );
    const date = screen.getByLabelText(new RegExp(`^${words.visitDate}`));
    expect(date).toHaveAttribute("min", "2026-11-06");
    expect(date).toHaveAttribute("max", "2027-11-06");
  });

  it("hands the request type and the typed values over when it is sent", () => {
    const onSubmit = vi.fn();
    renderWithMessages(<ProjectLeadCard state="form" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("radio", { name: words.siteVisit }));
    fill(words.name, "Priya Raman");
    fill(words.visitDate, "2026-11-08");
    fireEvent.click(screen.getByRole("button", { name: words.requestVisit }));
    expect(onSubmit).toHaveBeenCalledWith("site_visit", {
      name: "Priya Raman",
      email: "",
      visitDate: "2026-11-08",
      message: "",
    });
  });

  it("marks a field with an error as invalid and says what is wrong", () => {
    renderWithMessages(
      <ProjectLeadCard
        state="form"
        defaultKind="site_visit"
        errors={{ name: "Your name is required.", visitDate: "Choose a date for the visit." }}
      />,
    );
    expect(screen.getByLabelText(new RegExp(`^${words.name}`))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Your name is required.")).toBeInTheDocument();
    expect(screen.getByText("Choose a date for the visit.")).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(`^${words.email}`))).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("moves focus to the first field with an error that arrives after it is shown", () => {
    const { rerender } = render(wrap(<ProjectLeadCard state="form" />));
    expect(screen.getByLabelText(new RegExp(`^${words.name}`))).not.toHaveFocus();
    rerender(
      wrap(<ProjectLeadCard state="form" errors={{ email: "Enter a valid email address." }} />),
    );
    expect(screen.getByLabelText(new RegExp(`^${words.email}`))).toHaveFocus();
  });

  it("says to wait a little, and keeps the form, when the visitor sent too many", () => {
    renderWithMessages(<ProjectLeadCard state="form" rateLimited />);
    const alert = screen.getByRole("status");
    expect(within(alert).getByText(words.rateLimit.title)).toBeInTheDocument();
    expect(within(alert).getByText(words.rateLimit.body)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
  });

  it("says to try again, and keeps the form, when the request could not be sent", () => {
    renderWithMessages(<ProjectLeadCard state="form" failed />);
    expect(screen.getByText(words.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
  });

  it("shows no alert when there is nothing to wait for", () => {
    renderWithMessages(<ProjectLeadCard state="form" />);
    expect(screen.queryByText(words.rateLimit.title)).toBeNull();
    expect(screen.queryByText(words.failed)).toBeNull();
  });

  it("is busy and does nothing a second time while sending", () => {
    const onSubmit = vi.fn();
    renderWithMessages(<ProjectLeadCard state="form" submitting onSubmit={onSubmit} />);
    const send = screen.getByRole("button", { name: words.send });
    expect(send).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(send.closest("form") as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is the gate for a visitor who is not signed in: why, then sign in or create an account, and no form", () => {
    const { container } = renderWithMessages(
      <ProjectLeadCard
        state="signed_out"
        signInHref="/auth?gate=enquire&redirect=%2Fprojects%2Fkadal-vista"
        createAccountHref="/auth?redirect=%2Fprojects%2Fkadal-vista"
      />,
    );
    expect(container.querySelector("#enquiry")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: words.title })).toBeInTheDocument();
    expect(screen.getByText(words.gate.leadIn)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.gate.signIn })).toHaveAttribute(
      "href",
      "/auth?gate=enquire&redirect=%2Fprojects%2Fkadal-vista",
    );
    expect(screen.getByRole("link", { name: words.gate.createAccount })).toHaveAttribute(
      "href",
      "/auth?redirect=%2Fprojects%2Fkadal-vista",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("is replaced by the thank-you note once sent, with no form", () => {
    const { container } = renderWithMessages(<ProjectLeadCard state="sent" />);
    expect(container.querySelector("#enquiry")).not.toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: words.sent.title })).toBeInTheDocument();
    expect(screen.getByText(words.sent.body)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("ProjectMobileBar: Call, WhatsApp and Enquire on a phone (S4-T09)", () => {
  it("has Call and WhatsApp as icon buttons named for what they do, and Enquire leading to the card", () => {
    renderWithMessages(
      <ProjectMobileBar
        contact={{ call: "tel:+914412345678", whatsapp: "https://wa.me/914412345678" }}
      />,
    );
    expect(screen.getByRole("link", { name: bar.actions.call })).toHaveAttribute(
      "href",
      "tel:+914412345678",
    );
    const whatsapp = screen.getByRole("link", { name: new RegExp(bar.actions.whatsapp) });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/914412345678");
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: bar.bar.enquire })).toHaveAttribute("href", "#enquiry");
  });

  it("draws only what the project's number allows", () => {
    const { rerender } = render(
      wrap(<ProjectMobileBar contact={{ call: "tel:4412345678", whatsapp: null }} />),
    );
    expect(screen.getByRole("link", { name: bar.actions.call })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(bar.actions.whatsapp) })).toBeNull();
    rerender(wrap(<ProjectMobileBar contact={{ call: null, whatsapp: null }} />));
    expect(screen.queryByRole("link", { name: bar.actions.call })).toBeNull();
    expect(screen.getByRole("link", { name: bar.bar.enquire })).toBeInTheDocument();
  });

  it("is pinned to the bottom of the screen and not drawn from 1024 px", () => {
    const { container } = renderWithMessages(
      <ProjectMobileBar contact={{ call: null, whatsapp: null }} />,
    );
    const root = container.querySelector("[data-slot=project-mobile-bar]") as HTMLElement;
    expect(root).toHaveClass("fixed", "bottom-0", "lg:hidden");
  });
});
