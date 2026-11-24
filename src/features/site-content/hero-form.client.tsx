"use client";

import { useTranslations } from "next-intl";
import type { SponsorStyle } from "@/lib/sponsors";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import {
  SiteHeroFields,
  type SiteHeroFieldsWords,
  type SiteHeroValues,
} from "@/components/domain/site-hero-fields";
import { SponsorHeroPreview } from "@/components/domain/sponsor-hero-preview";
import { Alert } from "@/components/patterns/alert";
import {
  heroPayloadOf,
  heroPictureOf,
  heroProblemsOf,
  type HeroFormValues,
  type Problems,
  type StandardHero,
} from "./form";
import { heroViewOf, layoutWarningOf } from "./sponsor-draft";
import type { SponsorStorage } from "./sponsor-storage";
import type { SponsorEditView } from "./sponsor-view";
import {
  SponsorsPanel,
  useSponsors,
  type SaveSponsors,
  type SponsorProjectOption,
} from "./sponsors-panel.client";
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
  /** The sponsors as saved, in their order (S7-T11). */
  sponsors: readonly SponsorEditView[];
  /** The hero ad style as saved (ADR-182); the Showcase when none is. */
  sponsorStyle?: SponsorStyle;
  /** The live projects a sponsor can link to (ADR-189). */
  projects?: readonly SponsorProjectOption[];
  /** The action that saves the sponsor list: every sponsor change goes through it at once. */
  saveSponsors: SaveSponsors;
  /** Where sponsor pictures are sent; the real bucket unless a test gives its own. */
  storage?: SponsorStorage;
};

const NO_PROBLEMS: Problems = {};

/**
 * The admin's Hero page (S7-T10, FR-ADM-10, FR-ADM-11): the eyebrow, headline and subtitle, and the choice between the
 * Search Desk and Split layouts, beside a live picture of the hero. It works like the Header page: it keeps what is
 * typed, sends it to the save action, shows the server's problems on their boxes (a missing headline included), and
 * Discard puts the boxes back to what was loaded. The eyebrow shows on the home page in Split only, and only when a
 * sponsor banner is booked; the layout card says so.
 */
export function HeroForm({
  initial,
  standard,
  save,
  sponsors,
  sponsorStyle = "showcase",
  projects = [],
  saveSponsors,
  storage,
}: HeroFormProps) {
  const translate = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("hero");
  const flow = useSaveFlow(save, {
    title: translate("hero.saved.title"),
    text: translate("hero.saved.text"),
  });
  const [values, setValues] = useState<SiteHeroValues>(initial);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const sponsorState = useSponsors({
    sponsors,
    style: sponsorStyle,
    projects,
    save: saveSponsors,
    ...(storage ? { storage } : {}),
  });
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
      conversational: {
        label: translate("hero.layout.conversational.label"),
        hint: translate("hero.layout.conversational.hint"),
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
  const sponsorWords = sponsorState.words;
  const hero = heroViewOf(sponsorState.drafts, values.layout, sponsorState.style);
  const warning = layoutWarningOf(hero.coverage, hero.style);
  const styleName = sponsorWords.style[sponsorState.style];
  // The ad under the search bar, drawn small in the preview (ADR-190).
  const styled = hero.styled?.photo
    ? sponsorState.style === "showcase" && hero.styled.showcase
      ? {
          style: "showcase" as const,
          photo: hero.styled.photo.src,
          brand: hero.styled.brand ?? "",
          title: hero.styled.showcase.project,
          line: hero.styled.showcase.price,
        }
      : hero.styled.cinematic
        ? {
            style: "cinematic" as const,
            photo: hero.styled.photo.src,
            brand: hero.styled.brand ?? "",
            title: hero.styled.cinematic.headline,
          }
        : undefined
    : undefined;
  const layoutName = sponsorWords.preview.layouts[values.layout];
  const say = sponsorWords.say;

  return (
    <form onSubmit={submit} noValidate>
      <SiteContentLayout
        title={translate("hero.title")}
        description={translate("hero.description")}
        tabs={frame.tabs}
        tabsLabel={frame.tabsLabel}
        previewLabel={frame.previewLabel}
        preview={
          <SponsorHeroPreview
            title={picture.title}
            subtitle={picture.subtitle}
            layout={picture.layout}
            banner={hero.banner}
            styled={styled}
            words={sponsorWords.preview}
            {...(picture.eyebrow ? { eyebrow: picture.eyebrow } : {})}
            {...(hero.reason ? { reason: hero.reason } : {})}
            {...(hero.first
              ? {
                  caption: say.caption(
                    hero.first.advertiser || sponsorWords.manager.words.unnamed,
                    hero.first.shown,
                  ),
                }
              : {})}
          />
        }
        after={<SponsorsPanel state={sponsorState} />}
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
          layoutNote={
            <>
              <p className="text-caption text-muted">{say.layoutLive(layoutName)}</p>
              {warning?.kind === "none_can_show" ? (
                <Alert tone="warning" title={say.layoutNoneTitle(layoutName)}>
                  {warning.style
                    ? say.layoutNoneStyle(styleName)
                    : say.layoutNoneText(values.layout === "split", say.formatName(warning.format))}
                </Alert>
              ) : null}
              {warning?.kind === "some_missing" ? (
                <Alert
                  tone="warning"
                  title={
                    warning.style
                      ? say.layoutSomeStyleTitle(warning.missing, warning.active, styleName)
                      : say.layoutSomeTitle(warning.missing, warning.active, layoutName)
                  }
                >
                  {warning.style
                    ? say.layoutSomeStyleText(warning.missing, styleName)
                    : say.layoutSomeText(
                        warning.missing,
                        layoutName,
                        say.formatName(warning.format),
                      )}
                </Alert>
              ) : null}
            </>
          }
        />
      </SiteContentLayout>
    </form>
  );
}
