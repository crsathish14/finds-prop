// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  LegalDocumentFields,
  type LegalDocumentErrors,
  type LegalDocumentLimits,
  type LegalDocumentValues,
  type LegalDocumentWords,
} from "../legal-document-fields";

const WORDS: LegalDocumentWords = {
  summary: { title: "Summary", description: "A short line.", label: "Summary text" },
  sections: {
    title: "Sections",
    description: "In this order.",
    row: "Section",
    heading: "Heading",
    add: "Add section",
    remove: "Remove section",
    drag: "Drag",
    moveUp: "Move up",
    moveDown: "Move down",
    empty: "No sections yet.",
    full: "The page is full.",
  },
  blocks: {
    paragraph: "Paragraph",
    list: "List",
    listHint: "One item on each line.",
    table: "Table",
    addParagraph: "Add paragraph",
    addList: "Add list",
    addTable: "Add table",
    remove: "Remove",
    moveUp: "Move up",
    moveDown: "Move down",
    full: "This section is full.",
  },
  table: {
    caption: "Table caption",
    column: "Column",
    cell: "Cell",
    addRow: "Add row",
    removeRow: "Remove row",
    addColumn: "Add column",
    removeColumn: "Remove column",
  },
};

const LIMITS: LegalDocumentLimits = { sections: 3, blocks: 3, rows: 3, columns: 3 };

const VALUES: LegalDocumentValues = {
  summary: "About your details.",
  sections: [
    {
      id: "s1",
      heading: "Who we are",
      blocks: [{ id: "b1", type: "paragraph", text: "We run findsprop." }],
    },
    {
      id: "s2",
      heading: "What we collect",
      blocks: [
        { id: "b2", type: "list", items: "Phone\nEnquiries" },
        {
          id: "b3",
          type: "table",
          caption: "What and why",
          head: ["What", "Why"],
          rows: [["Phone", "Sign-in"]],
        },
      ],
    },
  ],
};

function setup(
  props: {
    values?: LegalDocumentValues;
    errors?: LegalDocumentErrors;
    limits?: LegalDocumentLimits;
    disabled?: boolean;
  } = {},
) {
  const onChange = vi.fn();
  render(
    <LegalDocumentFields
      values={props.values ?? VALUES}
      onChange={onChange}
      limits={props.limits ?? LIMITS}
      words={WORDS}
      {...(props.errors ? { errors: props.errors } : {})}
      {...(props.disabled ? { disabled: true } : {})}
    />,
  );
  return onChange;
}

function Stateful({ initial }: { initial: LegalDocumentValues }) {
  const [values, setValues] = useState(initial);
  return <LegalDocumentFields values={values} onChange={setValues} limits={LIMITS} words={WORDS} />;
}

describe("UT-legal-document-fields: the legal editor's boxes (ADR-151)", () => {
  it("shows the summary and every section as a named group, with its blocks", () => {
    setup();
    expect(screen.getByLabelText("Summary text")).toHaveValue("About your details.");
    const second = screen.getByRole("group", { name: "Section 2" });
    expect(within(second).getByLabelText("Heading")).toHaveValue("What we collect");
    expect(within(second).getByRole("group", { name: "List 1" })).toBeInTheDocument();
    expect(within(second).getByRole("group", { name: "Table 2" })).toBeInTheDocument();
    expect(within(second).getByLabelText("Cell 1.2")).toHaveValue("Sign-in");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("reports a typed heading with the whole new value", async () => {
    const onChange = setup();
    const heading = within(screen.getByRole("group", { name: "Section 1" })).getByLabelText(
      "Heading",
    );
    await userEvent.type(heading, "!");
    const next = onChange.mock.calls[0]?.[0] as LegalDocumentValues;
    expect(next.sections[0]?.heading).toBe("Who we are!");
    expect(next.sections[1]).toEqual(VALUES.sections[1]);
  });

  it("adds a section with one empty paragraph, and turns Add section off at the limit", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    const next = onChange.mock.calls[0]?.[0] as LegalDocumentValues;
    expect(next.sections).toHaveLength(3);
    expect(next.sections[2]?.blocks).toEqual([
      expect.objectContaining({ type: "paragraph", text: "" }),
    ]);
  });

  it("turns Add section off and says the page is full at the limit", () => {
    setup({ limits: { ...LIMITS, sections: 2 } });
    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
    expect(screen.getByText("The page is full.")).toBeInTheDocument();
  });

  it("removes a section", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Remove section: Who we are" }));
    const next = onChange.mock.calls[0]?.[0] as LegalDocumentValues;
    expect(next.sections.map((section) => section.id)).toEqual(["s2"]);
  });

  it("moves a block with the arrows: the first cannot go up, the last cannot go down", async () => {
    const onChange = setup();
    const second = screen.getByRole("group", { name: "Section 2" });
    expect(within(second).getByRole("button", { name: "Move up: List 1" })).toBeDisabled();
    expect(within(second).getByRole("button", { name: "Move down: Table 2" })).toBeDisabled();
    await userEvent.click(within(second).getByRole("button", { name: "Move down: List 1" }));
    const next = onChange.mock.calls[0]?.[0] as LegalDocumentValues;
    expect(next.sections[1]?.blocks.map((block) => block.id)).toEqual(["b3", "b2"]);
  });

  it("does not remove the last block of a section", () => {
    setup();
    const first = screen.getByRole("group", { name: "Section 1" });
    expect(within(first).getByRole("button", { name: "Remove: Paragraph 1" })).toBeDisabled();
  });

  it("adds a block of each kind, and turns the buttons off when the section is full", async () => {
    const onChange = setup();
    const first = screen.getByRole("group", { name: "Section 1" });
    await userEvent.click(within(first).getByRole("button", { name: "Add table" }));
    const next = onChange.mock.calls[0]?.[0] as LegalDocumentValues;
    expect(next.sections[0]?.blocks[1]).toMatchObject({
      type: "table",
      head: ["", ""],
      rows: [["", ""]],
    });
  });

  it("turns the add buttons off in a full section and says so", () => {
    setup({ limits: { ...LIMITS, blocks: 2 } });
    const second = screen.getByRole("group", { name: "Section 2" });
    expect(within(second).getByRole("button", { name: "Add paragraph" })).toBeDisabled();
    expect(within(second).getByRole("button", { name: "Add list" })).toBeDisabled();
    expect(within(second).getByRole("button", { name: "Add table" })).toBeDisabled();
    expect(within(second).getByText("This section is full.")).toBeInTheDocument();
  });

  it("adds a column to the heading and to every row, then removes it again", async () => {
    render(<Stateful initial={VALUES} />);
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));
    expect(screen.getByLabelText("Column 3")).toHaveValue("");
    expect(screen.getByLabelText("Cell 1.3")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Remove column 3" }));
    expect(screen.queryByLabelText("Column 3")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cell 1.3")).not.toBeInTheDocument();
  });

  it("adds a row as wide as the heading, and keeps one row and one column at least", async () => {
    render(<Stateful initial={VALUES} />);
    await userEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(screen.getByLabelText("Cell 2.1")).toHaveValue("");
    expect(screen.getByLabelText("Cell 2.2")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Remove row 2" }));
    expect(screen.getByRole("button", { name: "Remove row 1" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Remove column 2" }));
    expect(screen.getByRole("button", { name: "Remove column 1" })).toBeDisabled();
  });

  it("shows each problem next to its own box, in words", () => {
    setup({
      errors: {
        summary: "Summary needed.",
        "s1:heading": "Heading needed.",
        "b1:text": "Text needed.",
        "b3:table": "Rows must match the columns.",
      },
    });
    expect(screen.getByLabelText("Summary text")).toBeInvalid();
    expect(screen.getByText("Summary needed.")).toBeInTheDocument();
    const first = screen.getByRole("group", { name: "Section 1" });
    expect(within(first).getByLabelText("Heading")).toBeInvalid();
    expect(within(first).getByText("Text needed.")).toBeInTheDocument();
    expect(screen.getByText("Rows must match the columns.")).toBeInTheDocument();
  });

  it("says when there are no sections", () => {
    setup({ values: { summary: "", sections: [] } });
    expect(screen.getByText("No sections yet.")).toBeInTheDocument();
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
  });

  it("turns every box and button off while saving", () => {
    setup({ disabled: true });
    expect(screen.getByLabelText("Summary text")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
    expect(screen.getByLabelText("Cell 1.1")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add row" })).toBeDisabled();
  });
});
