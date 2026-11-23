"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LegalSaveBar } from "@/components/domain/legal-save-bar";
import {
  MailTemplateFields,
  type MailTemplateBoxes,
  type MailTemplateErrors,
  type MailTemplatePlaceholderRow,
} from "@/components/domain/mail-template-fields";
import { MailTemplatePreview } from "@/components/domain/mail-template-preview";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import {
  MAIL_BODY_MAX,
  MAIL_SAMPLE_VALUES,
  MAIL_SUBJECT_MAX,
  MAIL_TEMPLATE_PLACEHOLDERS,
  MAIL_TEMPLATE_REQUIRED,
  renderMailTemplate,
  type MailTemplateKind,
} from "@/lib/mail-template";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import type { MailTemplateEditPage } from "./types";

export type SaveMailTemplate = (input: {
  kind: MailTemplateKind;
  subject: string;
  body: string;
  publish: boolean;
}) => Promise<ActionResult<unknown>>;

export type MailTemplatesFormProps = {
  pages: Record<MailTemplateKind, MailTemplateEditPage>;
  /** The save action. */
  save: SaveMailTemplate;
};

const LIMITS = { subject: MAIL_SUBJECT_MAX, body: MAIL_BODY_MAX };

/** One mail: its boxes, its preview and its own Save draft and Publish. */
function MailCard({ page, save }: { page: MailTemplateEditPage; save: SaveMailTemplate }) {
  const translate = useTranslations("admin.emails");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const { kind } = page;
  const [values, setValues] = useState<MailTemplateBoxes>(page.template);
  const [errors, setErrors] = useState<MailTemplateErrors>({});
  const [mode, setMode] = useState<"draft" | "publish" | null>(null);

  const send = async (publish: boolean) => {
    if (mode !== null) return;
    setMode(publish ? "publish" : "draft");
    try {
      const result = await save({ kind, subject: values.subject, body: values.body, publish });
      if (result.ok) {
        notify.success(translate(publish ? "saved.published.title" : "saved.draft.title"), {
          description: translate(publish ? "saved.published.text" : "saved.draft.text"),
        });
        setErrors({});
        router.refresh();
        return;
      }
      const found: MailTemplateErrors = {};
      for (const field of ["subject", "body"] as const) {
        const first = result.fieldErrors?.[field]?.[0];
        if (first) found[field] = fieldErrorText(everything, first);
      }
      if (found.subject || found.body) {
        setErrors(found);
        return;
      }
      notify.error(failureText(everything, result));
      router.refresh();
    } finally {
      setMode(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(false);
  };

  const names = MAIL_TEMPLATE_PLACEHOLDERS[kind];
  const descriptions = {
    enquirerName: translate("placeholders.enquirerName"),
    propertyTitle: translate("placeholders.propertyTitle"),
    propertyLink: translate("placeholders.propertyLink"),
    dashboardLink: translate("placeholders.dashboardLink"),
    siteName: translate("placeholders.siteName"),
  };
  const placeholders: MailTemplatePlaceholderRow[] = names.map((name) => ({
    name,
    description: descriptions[name],
    required: MAIL_TEMPLATE_REQUIRED[kind].includes(name),
  }));

  const mail = renderMailTemplate(kind, values, MAIL_SAMPLE_VALUES);
  const live = page.published
    ? page.published.updated
      ? translate("status.live", { updated: page.published.updated })
      : translate("status.liveNoDate")
    : translate("status.standard");
  const status = page.hasUnpublishedChanges ? `${live} ${translate("status.draft")}` : live;
  const anchor = kind === "enquiry_poster" ? "mail-poster" : "mail-sender";

  return (
    <form onSubmit={submit} noValidate>
      <MailTemplateFields
        id={anchor}
        values={values}
        errors={errors}
        onChange={(next) => setValues(next)}
        limits={LIMITS}
        placeholders={placeholders}
        status={status}
        disabled={mode !== null}
        words={{
          title: translate(kind === "enquiry_poster" ? "poster.title" : "sender.title"),
          description: translate(
            kind === "enquiry_poster" ? "poster.description" : "sender.description",
          ),
          subject: { label: translate("subject.label"), hint: translate("subject.hint") },
          body: { label: translate("body.label"), hint: translate("body.hint") },
          counter: (used, max) => translate("counter", { used, max }),
          placeholders: {
            title: translate("placeholders.title"),
            required: translate("placeholders.required"),
          },
        }}
        preview={
          <MailTemplatePreview
            subject={mail.subject}
            text={mail.text}
            fellBack={mail.fellBack}
            words={{
              title: translate("preview.title"),
              subject: translate("preview.subject"),
              body: translate("preview.body"),
              fellBack: translate("preview.fellBack"),
            }}
          />
        }
        actions={
          <LegalSaveBar
            note={translate("save.note")}
            words={{
              discard: translate("save.discard"),
              saveDraft: translate("save.saveDraft"),
              publish: translate("save.publish"),
              saving: translate("save.saving"),
            }}
            saving={mode}
            sticky={false}
            onDiscard={() => {
              setValues(page.template);
              setErrors({});
            }}
            onPublish={() => void send(true)}
          />
        }
      />
    </form>
  );
}

/**
 * The admin's Emails page (ADR-183, part C): the wording of the two enquiry mails, each with its own boxes, preview
 * (filled in with made-up values by the same function the mail uses), Save draft and Publish. Save draft keeps the
 * changes private; Publish makes the wording the one that is sent. Both buttons are off while a save is pending. The
 * server's problems are put on the boxes they belong to, and the page is read again after every save.
 */
export function MailTemplatesForm({ pages, save }: MailTemplatesFormProps) {
  const translate = useTranslations("admin.emails");
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("description")}</Text>
      </header>
      <MailCard page={pages.enquiry_poster} save={save} />
      <MailCard page={pages.enquiry_sender} save={save} />
    </div>
  );
}
