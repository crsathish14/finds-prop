"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import {
  LegalDocumentFields,
  type LegalDocumentErrors,
  type LegalDocumentWords,
} from "@/components/domain/legal-document-fields";
import { LegalSaveBar } from "@/components/domain/legal-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import { Alert } from "@/components/patterns/alert";
import {
  LEGAL_EDITOR_LIMITS,
  payloadOf,
  problemsOf,
  valuesOf,
  type LegalEditorKind,
  type LegalPageText,
} from "./legal-form";
import {
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

export type LegalFormProps = {
  kind: LegalEditorKind;
  initial: {
    /** What the boxes start with: the working copy, else the live text, else the text in code. */
    document: LegalPageText;
    /** True when a working copy has been saved but not published. */
    hasUnpublishedChanges: boolean;
    /** The live version, or null while visitors still see the placeholder text from code. */
    published: { updated: string | null; version: string | null } | null;
  };
  /** The save action. */
  save: SaveContent;
};

/**
 * The admin's Privacy Policy and Terms of Use pages (ADR-151, part C). The boxes are the legal editor's
 * (`LegalDocumentFields`); the bar has Save draft (kept private: visitors still read the live text) and Publish (live
 * now, with today's date and the next version). Publish and Save draft are off while a save is pending, because a
 * repeated Publish would raise the version twice. Discard puts the boxes back to what was loaded. The server's
 * problems are put on the boxes they belong to, and the page is read again after every save.
 */
export function LegalForm({ kind, initial, save }: LegalFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame(kind);
  const flow = useSaveFlow(save, {
    title: translate("legal.saved.draft.title"),
    text: translate("legal.saved.draft.text"),
  });
  const [values, setValues] = useState(() => valuesOf(initial.document));
  const [errors, setErrors] = useState<LegalDocumentErrors>({});
  const [mode, setMode] = useState<"draft" | "publish" | null>(null);
  const alertAt = useScrollToProblems(errors);

  const send = async (publish: boolean) => {
    if (flow.saving) return;
    setMode(publish ? "publish" : "draft");
    try {
      const found = await flow.submit(
        payloadOf(kind, values, publish),
        publish
          ? {
              title: translate("legal.saved.published.title"),
              text: translate("legal.saved.published.text"),
            }
          : undefined,
      );
      setErrors(problemsOf(values, found));
    } finally {
      setMode(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(false);
  };

  const words: LegalDocumentWords = {
    summary: {
      title: translate("legal.words.summary.title"),
      description: translate("legal.words.summary.description"),
      label: translate("legal.words.summary.label"),
    },
    sections: {
      title: translate("legal.words.sections.title"),
      description: translate("legal.words.sections.description"),
      row: translate("legal.words.sections.row"),
      heading: translate("legal.words.sections.heading"),
      add: translate("legal.words.sections.add"),
      remove: translate("legal.words.sections.remove"),
      drag: translate("legal.words.sections.drag"),
      moveUp: translate("legal.words.sections.moveUp"),
      moveDown: translate("legal.words.sections.moveDown"),
      empty: translate("legal.words.sections.empty"),
      full: translate("legal.words.sections.full"),
    },
    blocks: {
      paragraph: translate("legal.words.blocks.paragraph"),
      list: translate("legal.words.blocks.list"),
      listHint: translate("legal.words.blocks.listHint"),
      table: translate("legal.words.blocks.table"),
      addParagraph: translate("legal.words.blocks.addParagraph"),
      addList: translate("legal.words.blocks.addList"),
      addTable: translate("legal.words.blocks.addTable"),
      remove: translate("legal.words.blocks.remove"),
      moveUp: translate("legal.words.blocks.moveUp"),
      moveDown: translate("legal.words.blocks.moveDown"),
      full: translate("legal.words.blocks.full"),
    },
    table: {
      caption: translate("legal.words.table.caption"),
      column: translate("legal.words.table.column"),
      cell: translate("legal.words.table.cell"),
      addRow: translate("legal.words.table.addRow"),
      removeRow: translate("legal.words.table.removeRow"),
      addColumn: translate("legal.words.table.addColumn"),
      removeColumn: translate("legal.words.table.removeColumn"),
    },
  };

  const count = Object.keys(errors).length;
  const status = initial.published
    ? initial.published.version && initial.published.updated
      ? translate("legal.status.live", {
          version: initial.published.version,
          updated: initial.published.updated,
        })
      : translate("legal.status.liveNoDate")
    : translate("legal.status.placeholder");

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate(kind === "privacy" ? "legal.privacy.title" : "legal.terms.title")}
        description={translate(
          kind === "privacy" ? "legal.privacy.description" : "legal.terms.description",
        )}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <div aria-hidden="true" className="flex flex-col gap-3 text-small text-muted">
            <p className="whitespace-pre-line">
              {values.summary.trim() || translate("legal.preview.noSummary")}
            </p>
            {values.sections.length === 0 ? (
              <p>{translate("legal.preview.noSections")}</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5">
                {values.sections.map((section) => (
                  <li key={section.id} className="text-ink">
                    {section.heading.trim() || translate("legal.preview.noHeading")}
                  </li>
                ))}
              </ol>
            )}
          </div>
        }
        top={
          <div className="flex flex-col gap-3">
            {count > 0 ? (
              <div ref={alertAt} tabIndex={-1}>
                <Alert tone="danger" title={translate("problems.title", { count })}>
                  {translate("problems.text")}
                </Alert>
              </div>
            ) : null}
            <Alert tone={initial.hasUnpublishedChanges ? "warning" : "info"}>
              {status}
              {initial.hasUnpublishedChanges ? ` ${translate("legal.status.unpublished")}` : ""}
            </Alert>
          </div>
        }
        footer={
          <LegalSaveBar
            note={translate("legal.save.note")}
            words={{
              discard: translate("legal.save.discard"),
              saveDraft: translate("legal.save.saveDraft"),
              publish: translate("legal.save.publish"),
              saving: translate("legal.save.saving"),
            }}
            saving={mode}
            onDiscard={() => {
              setValues(valuesOf(initial.document));
              setErrors({});
            }}
            onPublish={() => void send(true)}
          />
        }
      >
        <LegalDocumentFields
          values={values}
          errors={errors}
          onChange={(next) => {
            setValues(next);
          }}
          limits={LEGAL_EDITOR_LIMITS}
          disabled={flow.saving}
          words={words}
        />
      </SiteContentLayout>
    </form>
  );
}
