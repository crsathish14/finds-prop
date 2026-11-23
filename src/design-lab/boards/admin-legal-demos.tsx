"use client";

import { useState } from "react";
import {
  LegalDocumentFields,
  type LegalDocumentErrors,
  type LegalDocumentLimits,
  type LegalDocumentValues,
  type LegalDocumentWords,
} from "@/components/domain/legal-document-fields";
import { LegalSaveBar } from "@/components/domain/legal-save-bar";
import { Specimen } from "../frame";

/**
 * The legal editor's boxes in their states (ADR-151, part B): the summary and the sections of a page with their
 * paragraphs, lists and tables. Plain English text; nothing here goes anywhere. Every word is unapproved and is listed
 * in ADR-151 for the owner to confirm.
 */

const LIMITS: LegalDocumentLimits = { sections: 30, blocks: 40, rows: 60, columns: 6 };

export const LEGAL_WORDS: LegalDocumentWords = {
  summary: {
    title: "Summary",
    description: "A short plain-language line at the top of the page.",
    label: "Summary",
  },
  sections: {
    title: "Sections",
    description: "The page reads in this order. The list beside the page links to each heading.",
    row: "Section",
    heading: "Heading",
    add: "Add section",
    remove: "Remove section",
    drag: "Drag",
    moveUp: "Move up",
    moveDown: "Move down",
    empty: "No sections yet. Add one to start the page.",
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

const FILLED: LegalDocumentValues = {
  summary: "What we collect, why we collect it and the choices you have.",
  sections: [
    {
      id: "s1",
      heading: "Who we are",
      blocks: [
        {
          id: "b1",
          type: "paragraph",
          text: "findsprop helps people in Tamil Nadu find homes. This page explains how we handle your details.",
        },
      ],
    },
    {
      id: "s2",
      heading: "What we collect",
      blocks: [
        {
          id: "b2",
          type: "list",
          items: "Your phone number, to sign you in\nThe enquiries you send\nThe homes you save",
        },
        {
          id: "b3",
          type: "table",
          caption: "What is collected and why",
          head: ["What", "Why", "How long"],
          rows: [
            ["Phone number", "Sign-in and enquiries", "While your account exists"],
            ["Enquiry text", "To reach the owner", "2 years"],
          ],
        },
      ],
    },
  ],
};

const EMPTY: LegalDocumentValues = { summary: "", sections: [] };

function Editor({
  initial,
  errors,
  limits = LIMITS,
  disabled = false,
}: {
  initial: LegalDocumentValues;
  errors?: LegalDocumentErrors;
  limits?: LegalDocumentLimits;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <LegalDocumentFields
      values={values}
      onChange={setValues}
      limits={limits}
      disabled={disabled}
      className="w-full"
      words={LEGAL_WORDS}
      {...(errors ? { errors } : {})}
    />
  );
}

const SAVE_NOTE =
  "Save draft keeps your changes private. Publish makes this text live and raises the version.";
const SAVE_WORDS = {
  discard: "Discard",
  saveDraft: "Save draft",
  publish: "Publish",
  saving: "Saving",
};

export function LegalDocumentFieldsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The save bar: Discard, Save draft and Publish (a phone puts the note above the buttons)">
        <div className="w-full max-w-4xl">
          <LegalSaveBar
            note={SAVE_NOTE}
            words={SAVE_WORDS}
            sticky={false}
            onDiscard={() => undefined}
            onPublish={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="The save bar while a draft is being saved: Publish is off">
        <div className="w-full max-w-4xl">
          <LegalSaveBar
            note={SAVE_NOTE}
            words={SAVE_WORDS}
            saving="draft"
            sticky={false}
            onDiscard={() => undefined}
            onPublish={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="The save bar while publishing: Save draft is off">
        <div className="w-full max-w-4xl">
          <LegalSaveBar
            note={SAVE_NOTE}
            words={SAVE_WORDS}
            saving="publish"
            sticky={false}
            onDiscard={() => undefined}
            onPublish={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="A page filled: a paragraph, a list and a table (type in a box, add and move things)">
        <Editor initial={FILLED} />
      </Specimen>
      <Specimen label="A new page: no sections yet">
        <Editor initial={EMPTY} />
      </Specimen>
      <Specimen label="Problems: a missing summary and heading, an empty paragraph and a table row that is the wrong width">
        <Editor
          initial={{
            summary: "",
            sections: [
              {
                id: "e1",
                heading: "",
                blocks: [{ id: "e2", type: "paragraph", text: "" }],
              },
              {
                id: "e3",
                heading: "What we collect",
                blocks: [
                  {
                    id: "e4",
                    type: "table",
                    caption: "",
                    head: ["What", "Why"],
                    rows: [["Phone number", ""]],
                  },
                ],
              },
            ],
          }}
          errors={{
            summary: "This field is required.",
            "e1:heading": "This field is required.",
            "e2:text": "This field is required.",
            "e4:caption": "This field is required.",
            "e4:table": "Every row needs a value in each column.",
          }}
        />
      </Specimen>
      <Specimen label="At the limits: two sections allowed, two blocks allowed, two rows and two columns allowed">
        <Editor initial={FILLED} limits={{ sections: 2, blocks: 2, rows: 2, columns: 3 }} />
      </Specimen>
      <Specimen label="While saving: every box and button is off">
        <Editor initial={FILLED} disabled />
      </Specimen>
    </div>
  );
}
