"use client";

import { useState } from "react";
import {
  MailTemplateFields,
  type MailTemplateBoxes,
  type MailTemplateErrors,
  type MailTemplatePlaceholderRow,
  type MailTemplateWords,
} from "@/components/domain/mail-template-fields";
import { MailTemplatePreview } from "@/components/domain/mail-template-preview";
import { LegalSaveBar } from "@/components/domain/legal-save-bar";
import {
  DEFAULT_MAIL_TEMPLATES,
  MAIL_BODY_MAX,
  MAIL_SAMPLE_VALUES,
  MAIL_SUBJECT_MAX,
  renderMailTemplate,
  type MailTemplateKind,
} from "@/lib/mail-template";
import { Specimen } from "../frame";

/**
 * The mail editor's boxes in their states (ADR-183, part B): one mail's subject and body, the words that can be used,
 * a preview filled in with made-up values and the save bar. Plain English text; nothing here goes anywhere. Every word
 * is unapproved and is listed in ADR-183 for the owner to confirm.
 */

const POSTER_WORDS: MailTemplateWords = {
  title: "Mail to the poster",
  description:
    "Sent to the person who posted the home, or to the builder or agent of the project, when someone sends an enquiry.",
  subject: { label: "Subject", hint: "One line, as the mail's title." },
  body: { label: "Message", hint: "Plain text. Line breaks are kept." },
  counter: (used, max) => `${used} of ${max}`,
  placeholders: {
    title: "Words you can use. They are filled in when the mail is sent.",
    required: "Required.",
  },
};

const SENDER_WORDS: MailTemplateWords = {
  ...POSTER_WORDS,
  title: "Confirmation to the enquirer",
  description: "Sent to the person who sent the enquiry, only when they typed an email address.",
};

const POSTER_PLACEHOLDERS: MailTemplatePlaceholderRow[] = [
  { name: "enquirerName", description: "The name the enquirer typed.", required: true },
  { name: "propertyTitle", description: "The title of the home or project.", required: false },
  { name: "propertyLink", description: "The public page of the home or project.", required: false },
  { name: "dashboardLink", description: "Your enquiries or leads page.", required: false },
  { name: "siteName", description: "The name of the site.", required: false },
];

const SENDER_PLACEHOLDERS = POSTER_PLACEHOLDERS.filter(
  (placeholder) => placeholder.name !== "dashboardLink",
).map((placeholder) => ({ ...placeholder, required: false }));

const PREVIEW_WORDS = {
  title: "Preview with made-up values",
  subject: "Subject",
  body: "Message",
  fellBack: "This wording cannot be used yet, so the standard wording is shown here.",
};

const SAVE_NOTE =
  "Save draft keeps your changes private. Publish makes this wording the one that is sent.";
const SAVE_WORDS = {
  discard: "Discard",
  saveDraft: "Save draft",
  publish: "Publish",
  saving: "Saving",
};

const LIMITS = { subject: MAIL_SUBJECT_MAX, body: MAIL_BODY_MAX };

function Editor({
  kind = "enquiry_poster",
  initial,
  errors,
  disabled = false,
  saving = null,
  status,
}: {
  kind?: MailTemplateKind;
  initial: MailTemplateBoxes;
  errors?: MailTemplateErrors;
  disabled?: boolean;
  saving?: "draft" | "publish" | null;
  status?: string;
}) {
  const [values, setValues] = useState(initial);
  const mail = renderMailTemplate(kind, values, MAIL_SAMPLE_VALUES);
  const poster = kind === "enquiry_poster";
  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="w-full max-w-4xl">
      <MailTemplateFields
        id={`lab-${kind}`}
        values={values}
        onChange={setValues}
        limits={LIMITS}
        placeholders={poster ? POSTER_PLACEHOLDERS : SENDER_PLACEHOLDERS}
        words={poster ? POSTER_WORDS : SENDER_WORDS}
        disabled={disabled}
        preview={
          <MailTemplatePreview
            subject={mail.subject}
            text={mail.text}
            fellBack={mail.fellBack}
            words={PREVIEW_WORDS}
          />
        }
        actions={
          <LegalSaveBar
            note={SAVE_NOTE}
            words={SAVE_WORDS}
            saving={saving}
            sticky={false}
            onDiscard={() => setValues(initial)}
            onPublish={() => undefined}
          />
        }
        {...(errors ? { errors } : {})}
        {...(status ? { status } : {})}
      />
    </form>
  );
}

const POSTER = DEFAULT_MAIL_TEMPLATES.enquiry_poster;
const SENDER = DEFAULT_MAIL_TEMPLATES.enquiry_sender;

export function MailTemplateFieldsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The poster's mail with the standard wording (type in a box and the preview follows)">
        <Editor initial={POSTER} status="Not published yet: the standard wording is sent." />
      </Specimen>
      <Specimen label="The enquirer's confirmation, live, with a saved draft waiting">
        <Editor
          kind="enquiry_sender"
          initial={SENDER}
          status="Live since 2026-11-24. You have a saved draft that is not live yet."
        />
      </Specimen>
      <Specimen label="Empty boxes: both are required, and the preview shows the standard wording">
        <Editor
          initial={{ subject: "", body: "" }}
          errors={{ subject: "This field is required.", body: "This field is required." }}
        />
      </Specimen>
      <Specimen label="Problems: a word that is not allowed in the subject, and the enquirer name missing from the mail">
        <Editor
          initial={{
            subject: "{phone} enquiry",
            body: "Hello,\n\nSomeone wrote about {propertyTitle}.",
          }}
          errors={{
            subject:
              "This wording uses a word in curly brackets that is not allowed here. Use only the words listed beside the boxes.",
            body: "Add the enquirer name word from the list beside the boxes, so the owner can see who wrote.",
          }}
        />
      </Specimen>
      <Specimen label="At the limits: a subject and a message that are as long as they may be">
        <Editor
          initial={{
            subject: `{enquirerName} ${"a".repeat(MAIL_SUBJECT_MAX - 15)}`,
            body: `{enquirerName}\n${"A long sentence that fills the box. ".repeat(56).slice(0, MAIL_BODY_MAX - 15)}`,
          }}
        />
      </Specimen>
      <Specimen label="While publishing: the boxes and Save draft are off">
        <Editor initial={POSTER} disabled saving="publish" />
      </Specimen>
    </div>
  );
}
