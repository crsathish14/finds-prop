// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { DynamicForm, type DynamicFormField } from "../dynamic-form";

const words = messages.domain.dynamicForm;

const field = (overrides: Partial<DynamicFormField> & Pick<DynamicFormField, "key" | "label">) =>
  ({ type: "text", required: false, ...overrides }) satisfies DynamicFormField;

const CONTACT: DynamicFormField[] = [
  field({ key: "name", label: "Your name", required: true }),
  field({ key: "mobile", label: "Mobile", required: true }),
  field({ key: "email", label: "Email", type: "email", placeholder: "you@example.com" }),
  field({
    key: "interest",
    label: "I am interested in",
    type: "dropdown",
    options: ["Buy", "Rent"],
  }),
  field({ key: "message", label: "Message", type: "textarea", max: 100 }),
];

describe("DynamicForm: the fields of a stored form (S5-T05, BR-60)", () => {
  it("draws each field with its label, marks the required ones and says the others are optional", () => {
    renderWithMessages(<DynamicForm fields={CONTACT} />);
    expect(screen.getByLabelText(/Your name/)).toBeRequired();
    expect(screen.getByLabelText(/Mobile/)).toBeRequired();
    expect(screen.getByLabelText(/Email/)).not.toBeRequired();
    expect(screen.getAllByText(words.optional)).toHaveLength(3);
  });

  it("asks the browser for the right keyboards and suggestions from the type and key", () => {
    renderWithMessages(<DynamicForm fields={CONTACT} />);
    expect(screen.getByLabelText(/Your name/)).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText(/Mobile/)).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("placeholder", "you@example.com");
  });

  it("offers a dropdown's own choices after an empty one, and counts a message that has a limit", async () => {
    renderWithMessages(<DynamicForm fields={CONTACT} />);
    const select = screen.getByLabelText(/I am interested in/);
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      words.choose,
      "Buy",
      "Rent",
    ]);
    const message = screen.getByLabelText(/Message/);
    expect(message).toHaveAttribute("maxlength", "100");
    await userEvent.type(message, "Hello");
    expect(screen.getByText("5 / 100")).toBeVisible();
  });

  it("uses the form's own button words, and the standard ones when it gives none", () => {
    const { unmount } = renderWithMessages(
      <DynamicForm fields={CONTACT} buttonText="Book a visit" />,
    );
    expect(screen.getByRole("button", { name: "Book a visit" })).toBeVisible();
    unmount();
    renderWithMessages(<DynamicForm fields={CONTACT} />);
    expect(screen.getByRole("button", { name: words.send })).toBeVisible();
  });

  it("hands over everything typed, by field key, when the form is sent", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(<DynamicForm fields={CONTACT} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.type(screen.getByLabelText(/Mobile/), "98400 12345");
    await userEvent.selectOptions(screen.getByLabelText(/I am interested in/), "Rent");
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Priya Raman",
      mobile: "98400 12345",
      email: "",
      interest: "Rent",
      message: "",
    });
  });

  it("starts from the values it is given", () => {
    renderWithMessages(<DynamicForm fields={CONTACT} values={{ name: "Priya Raman" }} />);
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman");
  });
});

describe("DynamicForm: the other field types", () => {
  it("draws a number with its limits, and a date", () => {
    renderWithMessages(
      <DynamicForm
        fields={[
          field({ key: "rooms", label: "Rooms", type: "number", min: 1, max: 9 }),
          field({ key: "day", label: "Day", type: "date" }),
        ]}
      />,
    );
    const rooms = screen.getByLabelText(/Rooms/);
    expect(rooms).toHaveAttribute("type", "number");
    expect(rooms).toHaveAttribute("min", "1");
    expect(rooms).toHaveAttribute("max", "9");
    expect(screen.getByLabelText(/Day/)).toHaveAttribute("type", "date");
  });

  it("draws radio buttons as a group with a legend, and hands over the chosen one", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(
      <DynamicForm
        onSubmit={onSubmit}
        fields={[field({ key: "plan", label: "Plan", type: "radio", options: ["Buy", "Rent"] })]}
      />,
    );
    expect(screen.getByRole("group", { name: /Plan/ })).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Rent" }));
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).toHaveBeenCalledWith({ plan: "Rent" });
  });

  it("draws checkboxes with options as a group, and hands over the ticked ones", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(
      <DynamicForm
        onSubmit={onSubmit}
        fields={[
          field({
            key: "likes",
            label: "Likes",
            type: "checkbox",
            options: ["Pool", "Gym", "Park"],
          }),
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Pool" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Park" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Pool" }));
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).toHaveBeenCalledWith({ likes: ["Park"] });
  });

  it("draws a checkbox with no options as one box, handed over as true or false", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(
      <DynamicForm
        onSubmit={onSubmit}
        fields={[field({ key: "agree", label: "I agree", type: "checkbox", required: true })]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).toHaveBeenLastCalledWith({ agree: false });
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).toHaveBeenLastCalledWith({ agree: true });
  });

  it("draws nothing for a file field until the upload step is built", () => {
    renderWithMessages(
      <DynamicForm fields={[field({ key: "attachment", label: "Attachment", type: "file" })]} />,
    );
    expect(screen.queryByText("Attachment")).not.toBeInTheDocument();
  });
});

describe("DynamicForm: what went wrong", () => {
  it("shows each error beside its field, marks the field invalid and ties the message to it", () => {
    renderWithMessages(
      <DynamicForm fields={CONTACT} errors={{ mobile: "Enter a valid mobile number." }} />,
    );
    const mobile = screen.getByLabelText(/Mobile/);
    expect(mobile).toBeInvalid();
    expect(mobile).toHaveAccessibleDescription("Enter a valid mobile number.");
    expect(screen.getByLabelText(/Your name/)).toBeValid();
  });

  it("shows the error of a group of choices in its fieldset", () => {
    renderWithMessages(
      <DynamicForm
        fields={[
          field({
            key: "plan",
            label: "Plan",
            type: "radio",
            options: ["Buy", "Rent"],
            required: true,
          }),
        ]}
        errors={{ plan: "This field is required." }}
      />,
    );
    expect(screen.getByRole("group", { name: /Plan/ })).toHaveAccessibleDescription(
      "This field is required.",
    );
  });

  it("says when the limit is reached, and when the send failed", () => {
    const { unmount } = renderWithMessages(<DynamicForm fields={CONTACT} rateLimited />);
    expect(screen.getByText(words.rateLimit.title)).toBeVisible();
    unmount();
    renderWithMessages(<DynamicForm fields={CONTACT} failed />);
    expect(screen.getByRole("alert")).toHaveTextContent(words.failed.title);
  });

  it("ignores a second click while it is sending, and keeps what was typed", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(
      <DynamicForm fields={CONTACT} submitting onSubmit={onSubmit} values={{ name: "Priya" }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya");
  });

  it("shows the consent line under the button", () => {
    renderWithMessages(
      <DynamicForm fields={CONTACT} consent="We use these details only to reply." />,
    );
    expect(screen.getByText("We use these details only to reply.")).toBeVisible();
  });

  it("shows a locked field read-only with the value and hint the page gives, and does not send it", async () => {
    const onSubmit = vi.fn();
    renderWithMessages(
      <DynamicForm
        fields={CONTACT}
        locked={{ mobile: { value: "+91 98••• ••345", hint: "The number you signed in with." } }}
        onSubmit={onSubmit}
      />,
    );
    const mobile = screen.getByLabelText(/Mobile/);
    expect(mobile).toHaveValue("+91 98••• ••345");
    expect(mobile).toHaveAttribute("readonly");
    expect(mobile).toHaveAccessibleDescription("The number you signed in with.");
    await userEvent.type(mobile, "123");
    expect(mobile).toHaveValue("+91 98••• ••345");
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
    await userEvent.click(screen.getByRole("button", { name: words.send }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ name: "Priya Raman", mobile: "" });
  });

  it("keeps one column at every width when it is compact", () => {
    const { container } = renderWithMessages(<DynamicForm fields={CONTACT} compact />);
    const form = container.querySelector("form");
    expect(form).not.toHaveClass("md:grid-cols-2");
    expect(container.querySelector(".md\\:col-span-2")).toBeNull();
  });

  it("is two columns from 768 px when it is not compact", () => {
    const { container } = renderWithMessages(<DynamicForm fields={CONTACT} />);
    expect(container.querySelector("form")).toHaveClass("md:grid-cols-2");
  });
});
