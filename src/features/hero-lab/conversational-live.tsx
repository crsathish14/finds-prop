import type { ReactNode } from "react";
import { ConversationalHero } from "@/components/domain/conversational-hero";
import { HomeSearchBar } from "@/components/domain/home-search-bar.client";
import { HomeAiSearch } from "@/features/ai-chat";
import { SEARCH_PATH, type CuratedLocality } from "@/features/search";
import { getTranslate } from "@/features/site";
import type { Translate } from "@/lib/format";
import { trustPoints } from "./trust";
import { PauseWhenHidden } from "./tab-pause.client";

/** How many sample requests the conversational hero types, and how many it offers as chips. */
const SUGGESTION_COUNT = 3;

/**
 * The sample requests of the conversational hero. They name the super admin's curated localities
 * when there are some (so they follow the city), and name no place otherwise.
 */
export function sampleRequests(
  translate: Translate,
  localities: readonly CuratedLocality[],
): string[] {
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

type ConversationalLiveProps = {
  title: string;
  emphasis?: string | undefined;
  subtitle?: string | undefined;
  /** FLAG_AI_SEARCH: the AI search bar while on, the keyword bar otherwise (as every hero). */
  aiSearch: boolean;
  localities: readonly CuratedLocality[];
  /** The sponsored strip (a SponsorSlot), left out when no ad qualifies. */
  sponsor?: ReactNode;
};

/**
 * The Conversational hero as the live homepage and the hero lab render it (ADR-177): the shared
 * ConversationalHero with the joined search bar (typed sample requests and "Try" chips), the
 * three trust lines, and the loops paused while the tab is hidden. One place, so the lab's C and
 * the live page cannot drift apart.
 */
export async function ConversationalLive({
  title,
  emphasis,
  subtitle,
  aiSearch,
  localities,
  sponsor,
}: ConversationalLiveProps) {
  const translate = await getTranslate();
  const requests = sampleRequests(translate, localities);
  const extras = {
    examples: requests,
    suggestions: requests.slice(0, SUGGESTION_COUNT),
    appearance: "joined",
  } as const;
  return (
    <PauseWhenHidden>
      <ConversationalHero
        title={title}
        emphasis={emphasis}
        subtitle={subtitle}
        prompt={translate("heroLab.conversational.prompt")}
        trust={trustPoints(translate).map((point) => point.line)}
        sponsor={sponsor}
      >
        {aiSearch ? (
          <HomeAiSearch {...extras} />
        ) : (
          <HomeSearchBar mode="keyword" action={SEARCH_PATH} {...extras} />
        )}
      </ConversationalHero>
    </PauseWhenHidden>
  );
}
