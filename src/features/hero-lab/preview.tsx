import type { ReactNode } from "react";
import { HomeHero } from "@/components/domain/home-hero";
import { HomeSearchBar } from "@/components/domain/home-search-bar.client";
import { SponsorSlot } from "@/components/layout/sponsor-slot";
import { HomeAiSearch } from "@/features/ai-chat";
import { SEARCH_PATH, type CuratedLocality } from "@/features/search";
import { getTranslate } from "@/features/site";
import type { Translate } from "@/lib/format";
import { selectSponsors, type SponsorAd } from "@/lib/sponsors";
import { ConversationalHero } from "./conversational-hero";
import { HeroLab } from "./hero-lab.client";
import { LayeredHero } from "./layered-hero";
import type { HeroLabLayout } from "./layouts";

/** How many sample requests the conversational hero types, and how many it offers as chips. */
const SUGGESTION_COUNT = 3;

/**
 * The sample requests of the conversational hero. They name the super admin's curated localities
 * when there are some (so they follow the city), and name no place otherwise.
 */
function sampleRequests(translate: Translate, localities: readonly CuratedLocality[]): string[] {
  // "Adyar, Chennai" reads as "Adyar": the city is already on the page.
  const places = localities
    .map((place) => (place.label.split(",")[0] ?? "").trim())
    .filter(Boolean);
  if (places.length === 0) {
    return [
      translate("heroLab.plainExamples.budget"),
      translate("heroLab.plainExamples.rent"),
      translate("heroLab.plainExamples.ready"),
      translate("heroLab.plainExamples.family"),
    ];
  }
  const place = (index: number) => places[index % places.length] ?? "";
  return [
    translate("heroLab.examples.budget", { place: place(0) }),
    translate("heroLab.examples.rent", { place: place(1) }),
    translate("heroLab.examples.ready", { place: place(2) }),
    translate("heroLab.examples.family", { place: place(3) }),
  ];
}

type HeroLabPreviewProps = {
  /** The layout the super admin chose, and that hero exactly as the live page renders it. */
  live: "desk" | "split";
  liveHero: ReactNode;
  title: string;
  emphasis?: string | undefined;
  subtitle?: string | undefined;
  eyebrow?: string | undefined;
  ads: SponsorAd[];
  /** FLAG_AI_SEARCH: the AI search bar while on, the keyword bar otherwise (as the live page). */
  aiSearch: boolean;
  localities: readonly CuratedLocality[];
};

/**
 * The homepage hero inside the hero lab: renders the live layout, the other live layout (when an ad
 * fits it) and the three experiments on the server, and hands them to the switch. Only the page's
 * Design Lab branch uses this; production renders the live hero alone.
 * Every hero uses the page's own search (same submit, same chat hand-over) and the same sponsored
 * ads through SponsorSlot (same rules, label, "About this ad" and carousel).
 */
export async function HeroLabPreview({
  live,
  liveHero,
  title,
  emphasis,
  subtitle,
  eyebrow,
  ads,
  aiSearch,
  localities,
}: HeroLabPreviewProps) {
  const translate = await getTranslate();
  const requests = sampleRequests(translate, localities);
  const search = aiSearch ? (
    <HomeAiSearch />
  ) : (
    <HomeSearchBar mode="keyword" action={SEARCH_PATH} />
  );
  const conversationalSearch = aiSearch ? (
    <HomeAiSearch
      examples={requests}
      suggestions={requests.slice(0, SUGGESTION_COUNT)}
      appearance="joined"
    />
  ) : (
    <HomeSearchBar
      mode="keyword"
      action={SEARCH_PATH}
      examples={requests}
      suggestions={requests.slice(0, SUGGESTION_COUNT)}
      appearance="joined"
    />
  );
  // D: the same joined bar as C, without the typed hint and the chips.
  const layeredSearch = aiSearch ? (
    <HomeAiSearch appearance="joined" />
  ) : (
    <HomeSearchBar mode="keyword" action={SEARCH_PATH} appearance="joined" />
  );

  const fits = (layout: "search_desk" | "split") =>
    selectSponsors({ ads, placement: "hero", layout }).sponsors.length > 0;
  const strip = fits("search_desk") ? (
    <SponsorSlot ads={ads} placement="hero" layout="search_desk" />
  ) : undefined;
  const panel = fits("split") ? (
    <SponsorSlot ads={ads} placement="hero" layout="split" />
  ) : undefined;

  const shared = { title, emphasis, subtitle, eyebrow, strip, panel };
  const heroA =
    live === "desk" ? (
      liveHero
    ) : (
      <HomeHero title={title} emphasis={emphasis} subtitle={subtitle} sponsor={strip}>
        {search}
      </HomeHero>
    );
  // B needs a panel ad; without one the live page would show A, so B is not offered.
  const heroB =
    live === "split" ? (
      liveHero
    ) : panel ? (
      <HomeHero
        title={title}
        emphasis={emphasis}
        subtitle={subtitle}
        layout="split"
        eyebrow={eyebrow}
        trust={[
          translate("home.hero.trust.approved"),
          translate("home.hero.trust.enquire"),
          translate("home.hero.trust.compare"),
        ]}
        sponsor={panel}
      >
        {search}
      </HomeHero>
    ) : undefined;

  const heroes: Partial<Record<HeroLabLayout, ReactNode>> = {
    desk: heroA,
    split: heroB,
    conversational: <ConversationalHero {...shared} search={conversationalSearch} />,
    layered: <LayeredHero {...shared} search={layeredSearch} />,
  };

  return <HeroLab live={live} heroes={heroes} />;
}
