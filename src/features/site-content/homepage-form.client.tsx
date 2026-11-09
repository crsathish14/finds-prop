"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import {
  SiteHomepageFields,
  type SiteHomepageFieldsWords,
  type SiteHomepageValues,
} from "@/components/domain/site-homepage-fields";
import { SiteHomepagePreview } from "@/components/domain/site-homepage-preview";
import { Alert } from "@/components/patterns/alert";
import { DEFAULT_LOCALITY_RADIUS_KM, LOCALITIES_MAX, LOCALITY_RADII_KM } from "./constants";
import {
  POPULAR_CHIPS,
  homepagePayloadOf,
  homepagePictureOf,
  localityProblemsOf,
  localityRowsOf,
  type HomepageFormValues,
  type HomepageSectionKey,
  type Problems,
} from "./form";
import {
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

export type HomepageFormProps = {
  /** Where the boxes start: what is saved (the defaults where nothing is saved). */
  initial: HomepageFormValues;
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

const startOf = (initial: HomepageFormValues): SiteHomepageValues => ({
  showFeatured: initial.showFeatured,
  showProjectTypes: initial.showProjectTypes,
  showDiscovery: initial.showDiscovery,
  showWhyUs: initial.showWhyUs,
  showCta: initial.showCta,
  localities: localityRowsOf(initial.localities, "place"),
});

/**
 * The admin's Homepage page (S7-T10, FR-ADM-10, ADD-11): a switch for each section below the hero and the list of
 * curated localities (a label, a latitude, a longitude and a radius each, in the order they are shown), beside a live
 * picture of the home page. It works like the Header page. The server reads the typed numbers and checks that each
 * place lies inside the launch area; a place outside it comes back as a problem on that row's latitude.
 */
export function HomepageForm({ initial, save }: HomepageFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("homepage");
  const flow = useSaveFlow(save, {
    title: translate("homepage.saved.title"),
    text: translate("homepage.saved.text"),
  });
  const [values, setValues] = useState<SiteHomepageValues>(() => startOf(initial));
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(await flow.submit(homepagePayloadOf(values)));
  };

  const words: SiteHomepageFieldsWords = {
    sections: {
      title: translate("homepage.sections.title"),
      description: translate("homepage.sections.description"),
      featured: {
        label: translate("homepage.sections.featured.label"),
        hint: translate("homepage.sections.featured.hint"),
      },
      projectTypes: {
        label: translate("homepage.sections.projectTypes.label"),
        hint: translate("homepage.sections.projectTypes.hint"),
      },
      discovery: {
        label: translate("homepage.sections.discovery.label"),
        hint: translate("homepage.sections.discovery.hint"),
      },
      whyUs: {
        label: translate("homepage.sections.whyUs.label"),
        hint: translate("homepage.sections.whyUs.hint"),
      },
      cta: {
        label: translate("homepage.sections.cta.label"),
        hint: translate("homepage.sections.cta.hint"),
      },
    },
    localities: {
      title: translate("homepage.localities.title"),
      description: translate("homepage.localities.description", { popular: POPULAR_CHIPS }),
      add: translate("homepage.localities.add"),
      limitTitle: translate("homepage.localities.limitTitle", { max: LOCALITIES_MAX }),
      limitText: translate("homepage.localities.limitText"),
      emptyTitle: translate("homepage.localities.emptyTitle"),
      emptyText: translate("homepage.localities.emptyText"),
      orderHint: translate("homepage.localities.orderHint"),
      row: translate("homepage.localities.row"),
      label: translate("homepage.localities.label"),
      lat: translate("homepage.localities.lat"),
      lng: translate("homepage.localities.lng"),
      radius: translate("homepage.localities.radius"),
      km: translate("homepage.localities.km"),
      remove: translate("homepage.localities.remove"),
      drag: translate("homepage.localities.drag"),
      moveUp: translate("homepage.localities.moveUp"),
      moveDown: translate("homepage.localities.moveDown"),
    },
  };

  const localityProblems = localityProblemsOf(problems, values.localities);
  const count = Object.keys(problems).length;
  const picture = homepagePictureOf(values);
  const sectionLabels: Record<HomepageSectionKey, string> = {
    hero: translate("homepage.preview.sections.hero"),
    discovery: translate("homepage.preview.sections.discovery"),
    featured: translate("homepage.preview.sections.featured"),
    projectTypes: translate("homepage.preview.sections.projectTypes"),
    whyUs: translate("homepage.preview.sections.whyUs"),
    cta: translate("homepage.preview.sections.cta"),
  };

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate("homepage.title")}
        description={translate("homepage.description")}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <SiteHomepagePreview
            sections={picture.sections.map((section) => ({
              label: sectionLabels[section.key],
              on: section.on,
            }))}
            popular={picture.popular}
            tiles={picture.tiles}
            hiddenNote={{
              title: translate("homepage.preview.hiddenTitle"),
              text: translate("homepage.preview.hiddenText"),
            }}
            words={{
              popular: translate("homepage.preview.popular"),
              explore: translate("homepage.preview.explore"),
              on: translate("homepage.preview.on"),
              off: translate("homepage.preview.off"),
            }}
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
        <SiteHomepageFields
          values={values}
          errors={Object.keys(localityProblems).length > 0 ? { localities: localityProblems } : {}}
          onChange={setValues}
          localitiesMax={LOCALITIES_MAX}
          radii={LOCALITY_RADII_KM}
          defaultRadius={DEFAULT_LOCALITY_RADIUS_KM}
          disabled={flow.saving}
          words={words}
        />
      </SiteContentLayout>
    </form>
  );
}
