// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { EnquiryCard, EnquiryCardSkeleton } from "../enquiry-card";
import { EnquirySheet } from "../enquiry-sheet";

const words = messages.domain.enquiry;

describe("EnquiryCard: signed out (S4-T01)", () => {
  it("asks the visitor to sign in, with a link to sign in and one to create an account", () => {
    renderWithMessages(
      <EnquiryCard state="signed_out" signInHref="/auth?gate=enquire" createAccountHref="/auth" />,
    );
    expect(screen.getByRole("heading", { level: 2, name: words.gate.title })).toBeVisible();
    expect(screen.getByText(words.gate.leadIn)).toBeVisible();
    expect(screen.getByRole("link", { name: words.gate.signIn })).toHaveAttribute(
      "href",
      "/auth?gate=enquire",
    );
    expect(screen.getByRole("link", { name: words.gate.createAccount })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("takes a lower heading level when it sits inside another page", () => {
    renderWithMessages(<EnquiryCard state="signed_out" headingAs="h3" />);
    expect(screen.getByRole("heading", { level: 3, name: words.gate.title })).toBeVisible();
  });
});

describe("EnquiryCard: the form (S4-T01)", () => {
  it("has the name and phone as required fields and the email and message as optional ones", () => {
    renderWithMessages(<EnquiryCard state="form" />);
    expect(screen.getByRole("heading", { level: 2, name: words.form.title })).toBeVisible();
    expect(screen.getByLabelText(new RegExp(words.form.name))).toBeRequired();
    expect(screen.getByLabelText(new RegExp(words.form.phone))).toBeRequired();
    expect(screen.getByLabelText(new RegExp(words.form.email))).not.toBeRequired();
    expect(screen.getByLabelText(new RegExp(words.form.message))).not.toBeRequired();
    expect(screen.getAllByText(words.optional)).toHaveLength(2);
  });

  it("asks the browser for the right keyboards and suggestions", () => {
    renderWithMessages(<EnquiryCard state="form" />);
    const phone = screen.getByLabelText(new RegExp(words.form.phone));
    expect(phone).toHaveAttribute("type", "tel");
    expect(phone).toHaveAttribute("autocomplete", "tel");
    expect(screen.getByLabelText(new RegExp(words.form.email))).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText(new RegExp(words.form.name))).toHaveAttribute(
      "autocomplete",
      "name",
    );
  });

  it("starts from the values it is given", () => {
    renderWithMessages(
      <EnquiryCard
        state="form"
        values={{ name: "Priya Raman", phone: "98400 12345", message: "Hello" }}
      />,
    );
    expect(screen.getByLabelText(new RegExp(words.form.name))).toHaveValue("Priya Raman");
    expect(screen.getByLabelText(new RegExp(words.form.phone))).toHaveValue("98400 12345");
    expect(screen.getByLabelText(new RegExp(words.form.message))).toHaveValue("Hello");
  });

  it("counts the characters of the message out of 1000, politely", async () => {
    renderWithMessages(<EnquiryCard state="form" />);
    const counter = screen.getByText("0 / 1000");
    expect(counter.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    await userEvent.type(screen.getByLabelText(new RegExp(words.form.message)), "Hello there");
    expect(screen.getByText("11 / 1000")).toBeInTheDocument();
  });

  it("limits the message to 1000 characters", () => {
    renderWithMessages(<EnquiryCard state="form" />);
    expect(screen.getByLabelText(new RegExp(words.form.message))).toHaveAttribute(
      "maxlength",
      "1000",
    );
  });

  it("hands over what was typed when the form is sent, and does not reload the page", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(<EnquiryCard state="form" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(new RegExp(words.form.name)), "Priya Raman");
    await userEvent.type(screen.getByLabelText(new RegExp(words.form.phone)), "9840012345");
    await userEvent.type(screen.getByLabelText(new RegExp(words.form.message)), "Is it available?");
    await userEvent.click(screen.getByRole("button", { name: words.form.send }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Priya Raman",
      phone: "9840012345",
      email: "",
      message: "Is it available?",
    });
  });

  it("never disables Send: an empty form is handed over, the page decides what is wrong", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(<EnquiryCard state="form" onSubmit={onSubmit} />);
    const send = screen.getByRole("button", { name: words.form.send });
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(onSubmit).toHaveBeenCalledWith({ name: "", phone: "", email: "", message: "" });
  });

  it("ignores the button while it is sending", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(<EnquiryCard state="form" submitting onSubmit={onSubmit} />);
    const send = screen.getByRole("button", { name: words.form.send });
    expect(send).toHaveAttribute("aria-busy", "true");
    await userEvent.click(send);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("EnquiryCard: errors and a failed send (S4-T01)", () => {
  it("ties each error to its field and marks the field invalid", () => {
    renderWithMessages(
      <EnquiryCard
        state="form"
        errors={{
          name: "Enter your name (2 to 80 characters).",
          phone: "Enter a phone number with 6 to 15 digits.",
        }}
      />,
    );
    const name = screen.getByLabelText(new RegExp(words.form.name));
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter your name (2 to 80 characters).");
    const phone = screen.getByLabelText(new RegExp(words.form.phone));
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAccessibleDescription("Enter a phone number with 6 to 15 digits.");
    expect(screen.getByLabelText(new RegExp(words.form.email))).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("does not take focus for errors that are there from the start", () => {
    renderWithMessages(<EnquiryCard state="form" errors={{ name: "Enter your name." }} />);
    expect(document.body).toHaveFocus();
  });

  it("moves focus to the first field with an error when errors arrive after it is shown", () => {
    const tree = (errors: Record<string, string>) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <EnquiryCard state="form" errors={errors} />
      </NextIntlClientProvider>
    );
    const view = render(tree({}));
    view.rerender(tree({ phone: "Enter a phone number with 6 to 15 digits." }));
    expect(screen.getByLabelText(new RegExp(words.form.phone))).toHaveFocus();
    view.rerender(
      tree({ name: "Enter your name.", phone: "Enter a phone number with 6 to 15 digits." }),
    );
    expect(screen.getByLabelText(new RegExp(words.form.name))).toHaveFocus();
  });

  it("shows the send-failed alert above the form and keeps what was typed", () => {
    renderWithMessages(
      <EnquiryCard state="form" failed values={{ name: "Priya Raman", message: "Still there" }} />,
    );
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(words.failed.title)).toBeVisible();
    expect(within(alert).getByText(words.failed.body)).toBeVisible();
    expect(screen.getByLabelText(new RegExp(words.form.name))).toHaveValue("Priya Raman");
    expect(screen.getByLabelText(new RegExp(words.form.message))).toHaveValue("Still there");
  });

  it("shows no alert when nothing failed", () => {
    renderWithMessages(<EnquiryCard state="form" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("EnquiryCard: sent (S4-T01)", () => {
  it("confirms politely and leads to the visitor's enquiries", () => {
    renderWithMessages(<EnquiryCard state="sent" enquiriesHref="/dashboard?tab=sent" />);
    const status = screen.getByRole("status");
    expect(within(status).getByRole("heading", { name: words.sent.title })).toBeVisible();
    expect(within(status).getByText(words.sent.body)).toBeVisible();
    expect(within(status).getByRole("link", { name: words.sent.viewEnquiries })).toHaveAttribute(
      "href",
      "/dashboard?tab=sent",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("EnquiryCard: the sheet variant (S4-T01)", () => {
  it("has the name, the phone and the message, with no heading, no email and no counter", () => {
    renderWithMessages(<EnquiryCard state="form" variant="sheet" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(words.form.name))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(words.form.phone))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(words.form.message))).toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(words.form.email))).not.toBeInTheDocument();
    expect(screen.queryByText("0 / 1000")).not.toBeInTheDocument();
    expect(screen.getByText(words.form.leadIn)).toBeVisible();
    expect(screen.getByPlaceholderText(words.form.messagePlaceholderShort)).toBeInTheDocument();
  });
});

describe("EnquiryCardSkeleton (S4-T01)", () => {
  it("is hidden from screen readers and has no heading, field or button", () => {
    const { container } = renderWithMessages(<EnquiryCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveAttribute("data-slot", "enquiry-card-skeleton");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EnquirySheet (S4-T01)", () => {
  it("is a dialog named Send an enquiry with the form inside, when it is open", () => {
    renderWithMessages(<EnquirySheet open onOpenChange={() => undefined} state="form" />);
    const dialog = screen.getByRole("dialog", { name: words.form.title });
    expect(within(dialog).getByLabelText(new RegExp(words.form.name))).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: words.close })).toBeInTheDocument();
  });

  it("opens from its trigger and closes with the close button", async () => {
    const view = renderWithMessages(<EnquirySheetHost />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enquire" }));
    expect(screen.getByRole("dialog", { name: words.form.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows the confirmation inside the sheet once sent", () => {
    renderWithMessages(<EnquirySheet open onOpenChange={() => undefined} state="sent" />);
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: words.sent.title }),
    ).toBeVisible();
  });
});

function EnquirySheetHost() {
  return <EnquirySheet state="form" trigger={<button type="button">Enquire</button>} />;
}

describe("EnquiryCard: Send switched off (S4-T03)", () => {
  it("draws the form with Send disabled and a line under it that describes the button", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(
      <EnquiryCard
        state="form"
        sendDisabled
        sendNotice="Sending is not open yet."
        onSubmit={onSubmit}
      />,
    );
    const send = screen.getByRole("button", { name: words.form.send });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription("Sending is not open yet.");
    // The fields can still be filled in; the form is the real one.
    await userEvent.type(screen.getByRole("textbox", { name: /Your name/ }), "Priya");
    await userEvent.click(send);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is unchanged without the options: Send works and nothing is added under it", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(<EnquiryCard state="form" onSubmit={onSubmit} />);
    const send = screen.getByRole("button", { name: words.form.send });
    expect(send).toBeEnabled();
    expect(send).not.toHaveAttribute("aria-describedby");
    await userEvent.click(send);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
