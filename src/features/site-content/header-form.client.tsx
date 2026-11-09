"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import {
  SiteHeaderFields,
  type SiteHeaderFieldsWords,
  type SiteHeaderValues,
} from "@/components/domain/site-header-fields";
import { SiteHeaderPreview } from "@/components/domain/site-header-preview";
import { Alert } from "@/components/patterns/alert";
import { HEADER_LINKS_MAX } from "./constants";
import {
  headerPayloadOf,
  headerPictureOf,
  headerProblemsOf,
  linkRowsOf,
  type HeaderFormValues,
  type Problems,
  type StandardHeader,
} from "./form";
import {
  useLinkListWords,
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

export type HeaderFormProps = {
  /** Where the boxes start: what is saved, or what visitors see today (see `headerFormOf`). */
  initial: HeaderFormValues;
  /** What the public header shows when nothing is saved: for the empty boxes and the picture. */
  standard: StandardHeader;
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

const startOf = (initial: HeaderFormValues): SiteHeaderValues => ({
  name: initial.name,
  links: linkRowsOf(initial.links, "link"),
  ctaLabel: initial.ctaLabel,
  ctaHref: initial.ctaHref,
});

/**
 * The admin's Header page (S7-T10, FR-ADM-10): the site name, the navigation links and the call-to-action button
 * beside a live picture of the header. It keeps what is typed, sends it to the save action and shows what the server
 * says is wrong on the boxes it belongs to; after a save the page is read again. Discard puts the boxes back to what
 * was loaded.
 */
export function HeaderForm({ initial, standard, save }: HeaderFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("header");
  const linkWords = useLinkListWords();
  const flow = useSaveFlow(save, {
    title: translate("header.saved.title"),
    text: translate("header.saved.text"),
  });
  const [values, setValues] = useState<SiteHeaderValues>(() => startOf(initial));
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(await flow.submit(headerPayloadOf(values)));
  };

  const words: SiteHeaderFieldsWords = {
    brand: {
      title: translate("header.brand.title"),
      description: translate("header.brand.text", { brandName: standard.brandName }),
    },
    links: {
      title: translate("header.navigation.title"),
      description: translate("header.navigation.text"),
    },
    cta: { title: translate("header.cta.title"), description: translate("header.cta.text") },
    name: translate("header.name"),
    ctaLabel: translate("header.ctaLabel"),
    ctaHref: translate("header.ctaHref"),
    optional: frame.optional,
    linkList: linkWords,
  };

  const found = headerProblemsOf(problems, values.links);
  const count = Object.keys(problems).length;
  const picture = headerPictureOf(values, standard);

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate("header.title")}
        description={translate("header.description")}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <SiteHeaderPreview
            brandName={picture.brandName}
            links={picture.links}
            {...(picture.cta ? { cta: picture.cta } : {})}
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
        <SiteHeaderFields
          values={values}
          errors={found}
          onChange={setValues}
          linksMax={HEADER_LINKS_MAX}
          disabled={flow.saving}
          words={words}
        />
      </SiteContentLayout>
    </form>
  );
}
