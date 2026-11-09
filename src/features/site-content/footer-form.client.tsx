"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import {
  SiteFooterFields,
  type SiteFooterFieldsWords,
  type SiteFooterValues,
} from "@/components/domain/site-footer-fields";
import { SiteFooterPreview } from "@/components/domain/site-footer-preview";
import { Alert } from "@/components/patterns/alert";
import { FOOTER_LINKS_MAX } from "./constants";
import {
  footerPayloadOf,
  footerPictureOf,
  footerProblemsOf,
  linkRowsOf,
  type FooterFormValues,
  type Problems,
  type StandardFooter,
} from "./form";
import {
  useLinkListWords,
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

export type FooterFormProps = {
  /** Where the boxes start: what is saved, or, with no links saved, the links visitors see today (see `footerFormOf`). */
  initial: FooterFormValues;
  /** What the public footer shows when nothing is saved: for the empty boxes and the picture. */
  standard: StandardFooter;
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

const startOf = (initial: FooterFormValues): SiteFooterValues => ({
  about: initial.about,
  phone: initial.phone,
  email: initial.email,
  address: initial.address,
  links: linkRowsOf(initial.links, "link"),
  copyright: initial.copyright,
});

/**
 * The admin's Footer page (S7-T10, FR-ADM-10): the about text, the contact details, the links and the copyright line
 * beside a live picture of the footer. It works like the Header page: it keeps what is typed, sends it to the save
 * action, shows the server's problems on their boxes, and Discard puts the boxes back to what was loaded.
 */
export function FooterForm({ initial, standard, save }: FooterFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("footer");
  const linkWords = useLinkListWords();
  const flow = useSaveFlow(save, {
    title: translate("footer.saved.title"),
    text: translate("footer.saved.text"),
  });
  const [values, setValues] = useState<SiteFooterValues>(() => startOf(initial));
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(await flow.submit(footerPayloadOf(values)));
  };

  const words: SiteFooterFieldsWords = {
    contact: {
      title: translate("footer.contact.title"),
      description: translate("footer.contact.text"),
    },
    links: {
      title: translate("footer.navigation.title"),
      description: translate("footer.navigation.text"),
    },
    about: translate("footer.about"),
    phone: translate("footer.phone"),
    email: translate("footer.email"),
    address: translate("footer.address"),
    copyright: translate("footer.copyright"),
    optional: frame.optional,
    linkList: linkWords,
  };

  const found = footerProblemsOf(problems, values.links);
  const count = Object.keys(problems).length;
  const picture = footerPictureOf(values, standard);

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate("footer.title")}
        description={translate("footer.description")}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <SiteFooterPreview
            brandName={picture.brandName}
            {...(picture.about ? { about: picture.about } : {})}
            contacts={picture.contacts}
            links={picture.links}
            copyright={picture.copyright}
          />
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
              setValues(startOf(initial));
              setProblems(NO_PROBLEMS);
            }}
          />
        }
      >
        <SiteFooterFields
          values={values}
          errors={found}
          onChange={setValues}
          linksMax={FOOTER_LINKS_MAX}
          disabled={flow.saving}
          words={words}
        />
      </SiteContentLayout>
    </form>
  );
}
