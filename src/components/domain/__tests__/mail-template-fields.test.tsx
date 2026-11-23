// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  MailTemplateFields,
  type MailTemplateBoxes,
  type MailTemplateErrors,
  type MailTemplatePlaceholderRow,
  type MailTemplateWords,
} from "../mail-template-fields";
import { MailTemplatePreview } from "../mail-template-preview";

const WORDS: MailTemplateWords = {
  title: "Mail to the poster",
  description: "Sent to whoever posted the home.",
  subject: { label: "Subject", hint: "One line." },
  body: { label: "Body", hint: "Plain text." },
  counter: (used, max) => `${used} of ${max}`,
  placeholders: { title: "Words you can use", required: "Required." },
};

const PLACEHOLDERS: MailTemplatePlaceholderRow[] = [
  { name: "enquirerName", description: "The name they typed.", required: true },
  { name: "propertyTitle", description: "The title of the home.", required: false },
];

const VALUES: MailTemplateBoxes = {
  subject: "From {enquirerName}",
  body: "Hello,\n{enquirerName} wrote.",
};

function Editor({
  initial = VALUES,
  errors,
  disabled,
  onChange,
}: {
  initial?: MailTemplateBoxes;
  errors?: MailTemplateErrors;
  disabled?: boolean;
  onChange?: (values: MailTemplateBoxes) => void;
}) {
  const [values, setValues] = useState(initial);
  return (
    <MailTemplateFields
      id="mail-poster"
      values={values}
      onChange={(next) => {
        setValues(next);
        onChange?.(next);
      }}
      limits={{ subject: 120, body: 2000 }}
      placeholders={PLACEHOLDERS}
      words={WORDS}
      {...(errors ? { errors } : {})}
      {...(disabled ? { disabled } : {})}
    />
  );
}

describe("UT-mail-template-fields: the boxes of one mail (ADR-183)", () => {
  it("shows the two boxes with their counters and the words that can be used, in curly brackets", () => {
    render(<Editor />);
    expect(screen.getByRole("heading", { name: "Mail to the poster" })).toBeTruthy();
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe(VALUES.subject);
    expect((screen.getByLabelText("Body") as HTMLTextAreaElement).value).toBe(VALUES.body);
    expect(screen.getByText(/One line. 19 of 120/)).toBeTruthy();
    expect(screen.getByText(/Plain text. 28 of 2000/)).toBeTruthy();
    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("{enquirerName}");
    expect(rows[0]?.textContent).toContain("Required.");
    expect(rows[1]?.textContent).toContain("{propertyTitle}");
    expect(rows[1]?.textContent).not.toContain("Required.");
  });

  it("reports each change with both boxes, so a page keeps one value", async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Subject"), "!");
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, subject: "From {enquirerName}!" });
    await userEvent.type(screen.getByLabelText("Body"), "?");
    expect(onChange).toHaveBeenLastCalledWith({
      subject: "From {enquirerName}!",
      body: `${VALUES.body}?`,
    });
  });

  it("ties a problem to its box in words", () => {
    render(<Editor errors={{ body: "Add the name word." }} />);
    const body = screen.getByLabelText("Body");
    expect(body.getAttribute("aria-invalid")).toBe("true");
    expect(body.getAttribute("aria-describedby")).toContain("-error");
    expect(screen.getByText("Add the name word.")).toBeTruthy();
    expect(screen.getByLabelText("Subject").getAttribute("aria-invalid")).toBeNull();
  });

  it("turns both boxes off while saving", () => {
    render(<Editor disabled />);
    expect((screen.getByLabelText("Subject") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Body") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("shows empty boxes and the status line, the preview and the actions it is given", () => {
    render(
      <MailTemplateFields
        id="mail-poster"
        values={{ subject: "", body: "" }}
        onChange={() => undefined}
        limits={{ subject: 120, body: 2000 }}
        placeholders={PLACEHOLDERS}
        status="You have a saved draft."
        words={WORDS}
        preview={<p>the preview</p>}
        actions={<button type="button">the actions</button>}
      />,
    );
    expect(screen.getByText("You have a saved draft.")).toBeTruthy();
    expect(screen.getByText("the preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "the actions" })).toBeTruthy();
    expect(screen.getByText(/One line\. 0 of 120/)).toBeTruthy();
  });
});

describe("UT-mail-template-preview: how one mail reads (ADR-183)", () => {
  const words = {
    title: "Preview",
    subject: "Subject",
    body: "Message",
    fellBack: "This wording cannot be used yet, so the standard wording is shown.",
  };

  it("shows the subject and the body, keeping the line breaks as text", () => {
    render(
      <MailTemplatePreview
        subject="From Sample Name"
        text={"Hello\n\n<b>Sample</b>"}
        words={words}
      />,
    );
    const group = screen.getByRole("group", { name: "Preview" });
    expect(within(group).getByText("From Sample Name")).toBeTruthy();
    const body = within(group).getByText(/Hello/);
    expect(body.textContent).toBe("Hello\n\n<b>Sample</b>");
    expect(body.querySelector("b")).toBeNull();
    expect(within(group).queryByText(words.fellBack)).toBeNull();
  });

  it("says when the standard wording is shown instead", () => {
    render(<MailTemplatePreview subject="S" text="T" fellBack words={words} />);
    expect(screen.getByText(words.fellBack)).toBeTruthy();
  });
});
