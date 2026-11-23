// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ContactEmailCard, type ContactEmailCardProps } from "../contact-email-card";

const words = en.domain.contactEmailCard;

function card(props: Partial<ContactEmailCardProps> = {}) {
  const handlers = {
    onSubmit: vi.fn((event) => event.preventDefault()),
    onChange: vi.fn(),
    onCancel: vi.fn(),
    onValueChange: vi.fn(),
  };
  const view = renderWithMessages(
    <ContactEmailCard email={null} value="" {...handlers} {...props} />,
  );
  return { ...handlers, view };
}

describe("ContactEmailCard (ADR-186)", () => {
  it("asks an owner with no address for one: a heading, a labelled box that says it is not checked, and Save", () => {
    const { onSubmit } = card();
    expect(screen.getByRole("heading", { level: 2, name: words.promptTitle })).toBeVisible();
    expect(screen.getByText(words.promptBody)).toBeVisible();
    const box = screen.getByLabelText(words.label);
    expect(box).toHaveAttribute("type", "email");
    expect(box).toHaveAccessibleDescription(words.hint);
    expect(screen.queryByRole("button", { name: words.change })).toBeNull();
    expect(screen.queryByRole("button", { name: words.cancel })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("passes what is typed on, and shows a problem with the address next to the box", () => {
    const { onValueChange } = card({ value: "owner@", error: "That is not an address." });
    fireEvent.change(screen.getByLabelText(words.label), { target: { value: "owner@x.test" } });
    expect(onValueChange).toHaveBeenCalledWith("owner@x.test");
    const box = screen.getByLabelText(words.label);
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription(expect.stringContaining("That is not an address."));
  });

  it("shows the saved address with Change and no box", () => {
    const { onChange } = card({ email: "owner@example.test" });
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Enquiries about your homes are emailed to owner@example.test",
      }),
    ).toBeVisible();
    expect(screen.getByText(words.savedBody)).toBeVisible();
    expect(screen.queryByLabelText(words.label)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: words.change }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("offers the box with Cancel while the address is being changed", () => {
    const { onCancel } = card({
      email: "owner@example.test",
      editing: true,
      value: "owner@example.test",
    });
    expect(screen.getByRole("heading", { level: 2, name: words.changeTitle })).toBeVisible();
    expect(screen.getByLabelText(words.label)).toHaveValue("owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: words.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("switches the box and the buttons off while saving, and says so", () => {
    card({ email: "owner@example.test", editing: true, busy: true, value: "new@example.test" });
    expect(screen.getByLabelText(words.label)).toBeDisabled();
    expect(screen.getByRole("button", { name: words.cancel })).toBeDisabled();
    expect(screen.getByRole("button", { name: words.saving })).toBeDisabled();
  });

  it("announces a failure that is not about the address", () => {
    card({ failure: "We couldn't save your email." });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't save your email.");
  });
});
