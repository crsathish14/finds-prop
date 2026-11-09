"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import {
  SiteHeroFields,
  type SiteHeroFieldsWords,
  type SiteHeroValues,
} from "@/components/domain/site-hero-fields";
import { SiteHeroPreview } from "@/components/domain/site-hero-preview";
import { Alert } from "@/components/patterns/alert";
import {
  heroPayloadOf,
  heroPictureOf,
  heroProblemsOf,
  type HeroFormValues,
  type Problems,
  type StandardHero,
} from "./form";
import {
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

export type HeroFormProps = {
  /** Where the boxes start: what is saved, with the headline visitors see today where none is saved. */
  initial: HeroFormValues;
  /** What the home page shows when a box is empty: for the picture. */
  standard: StandardHero;
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

/**
 * The admin's Hero page (S7-T10, FR-ADM-10, FR-ADM-11): the eyebrow, headline and subtitle, and the choice between the
 * Search Desk and Split layouts, beside a live picture of the hero. It works like the Header page: it keeps what is
 * typed, sends it to the save action, shows the server's problems on their boxes (a missing headline included), and
 * Discard puts the boxes back to what was loaded. The eyebrow shows on the home page in Split only, and only when a
 * sponsor banner is booked; the layout card says so.
 */
export function HeroForm({ initial, standard, save }: HeroFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("hero");
  const flow = useSaveFlow(save, {
    title: translate("hero.saved.title"),
    text: translate("hero.saved.text"),
  });
  const [values, setValues] = useState<SiteHeroValues>(initial);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(await flow.submit(heroPayloadOf(values)));
  };

  const words: SiteHeroFieldsWords = {
    text: { title: translate("hero.text.title") },
    layout: {
      title: translate("hero.layout.title"),
      description: translate("hero.layout.description"),
      searchDesk: {
        label: translate("hero.layout.searchDesk.label"),
        hint: translate("hero.layout.searchDesk.hint"),
      },
      split: {
        label: translate("hero.layout.split.label"),
        hint: translate("hero.layout.split.hint"),
      },
    },
    eyebrow: translate("hero.eyebrow"),
    eyebrowHint: translate("hero.eyebrowHint"),
    headline: translate("hero.headline"),
    subtitle: translate("hero.subtitle"),
    optional: frame.optional,
  };

  const count = Object.keys(problems).length;
  const picture = heroPictureOf(values, standard);

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate("hero.title")}
        description={translate("hero.description")}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <SiteHeroPreview
            title={picture.title}
            subtitle={picture.subtitle}
            layout={picture.layout}
            {...(picture.eyebrow ? { eyebrow: picture.eyebrow } : {})}
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
              setValues(initial);
              setProblems(NO_PROBLEMS);
            }}
          />
        }
      >
        <SiteHeroFields
          values={values}
          errors={heroProblemsOf(problems)}
          onChange={setValues}
          disabled={flow.saving}
          words={words}
        />
      </SiteContentLayout>
    </form>
  );
}
