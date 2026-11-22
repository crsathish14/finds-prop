"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { Textarea } from "@/components/ui/textarea";
import { DISCLAIMER_MAX } from "./constants";
import type { Problems } from "./form";
import {
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

export type DisclaimersFormValues = { footer: string; aiSearch: string };

export type DisclaimersFormProps = {
  /** Where the boxes start: the saved texts, empty where none is saved. */
  initial: DisclaimersFormValues;
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

/**
 * The admin's Disclaimers page (ADR-152): the plain text shown in the footer of every public page and the plain text
 * shown on the AI search page. An empty box shows nothing. It works like the Footer page: it keeps what is typed, sends
 * it to the save action, shows the server's problems on their boxes, and Discard puts the boxes back to what was loaded.
 */
export function DisclaimersForm({ initial, save }: DisclaimersFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("disclaimers");
  const flow = useSaveFlow(save, {
    title: translate("disclaimers.saved.title"),
    text: translate("disclaimers.saved.text"),
  });
  const [values, setValues] = useState<DisclaimersFormValues>(initial);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(await flow.submit({ footer: values.footer, aiSearch: values.aiSearch }));
  };

  const count = Object.keys(problems).length;
  const note = (text: string) =>
    translate("disclaimers.counter", { used: text.length, max: DISCLAIMER_MAX });

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate("disclaimers.title")}
        description={translate("disclaimers.description")}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <div aria-hidden="true" className="flex flex-col gap-4 text-small text-muted">
            <div>
              <p className="font-bold text-ink">{translate("disclaimers.footer.label")}</p>
              <p className="whitespace-pre-line">
                {values.footer.trim() || translate("disclaimers.nothing")}
              </p>
            </div>
            <div>
              <p className="font-bold text-ink">{translate("disclaimers.aiSearch.label")}</p>
              <p className="whitespace-pre-line">
                {values.aiSearch.trim() || translate("disclaimers.nothing")}
              </p>
            </div>
          </div>
        }
        top={
          count > 0 ? (
            <div ref={alertAt} tabIndex={-1}>
              <Alert tone="danger" title={translate("problems.title", { count })}>
                {translate("problems.text")}
              </Alert>
            </div>
          ) : null
        }
        footer={
          <ProjectSaveBar
            note={frame.saveNote}
            words={frame.saveWords}
            saving={flow.saving}
            onCancel={() => {
              setValues(initial);
              setProblems(NO_PROBLEMS);
            }}
          />
        }
      >
        <div className="flex flex-col gap-6">
          <FormSection
            id="disclaimer-footer"
            title={translate("disclaimers.footer.title")}
            description={translate("disclaimers.footer.text")}
          >
            <FormField
              label={translate("disclaimers.footer.label")}
              optionalLabel={frame.optional}
              hint={note(values.footer)}
              {...(problems["footer"] ? { error: problems["footer"] } : {})}
            >
              <Textarea
                value={values.footer}
                disabled={flow.saving}
                maxLength={DISCLAIMER_MAX}
                rows={5}
                onChange={(event) => setValues({ ...values, footer: event.target.value })}
              />
            </FormField>
          </FormSection>
          <FormSection
            id="disclaimer-ai-search"
            title={translate("disclaimers.aiSearch.title")}
            description={translate("disclaimers.aiSearch.text")}
          >
            <FormField
              label={translate("disclaimers.aiSearch.label")}
              optionalLabel={frame.optional}
              hint={note(values.aiSearch)}
              {...(problems["aiSearch"] ? { error: problems["aiSearch"] } : {})}
            >
              <Textarea
                value={values.aiSearch}
                disabled={flow.saving}
                maxLength={DISCLAIMER_MAX}
                rows={5}
                onChange={(event) => setValues({ ...values, aiSearch: event.target.value })}
              />
            </FormField>
          </FormSection>
        </div>
      </SiteContentLayout>
    </form>
  );
}
