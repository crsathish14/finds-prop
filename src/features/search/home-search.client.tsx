"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePlacePanel } from "@/components/domain/place-panel";
import { SearchCard } from "@/components/domain/search-card";
import { searchHrefFromCard, type CuratedLocality } from "./from-card";
import { popularLinks, quickPickLinks } from "./home-links";
import { PLACE_MIN_CHARACTERS, usePlaceSuggestions } from "./use-place-suggestions.client";

type HomeSearchProps = {
  /** The curated localities of the site content (DEC-13): the Popular chips, and a typed name that is one of them. */
  localities: readonly CuratedLocality[];
  projectsHref: string;
  /** Leave it out while AI search is off: the link is then not drawn. */
  aiSearchHref?: string | undefined;
  layout?: "wide" | "stacked";
};

/**
 * The search card of the homepage, joined to the results address: the visitor's choices become the
 * address of the results page (`searchHrefFromCard`) and the page opens. The locality box suggests
 * places from Ola Maps (ADR-136): picking one searches by its name, point and the default radius; text
 * that is not picked, or typed while suggestions are unavailable, goes as a locality text match, and a
 * name that is one of the curated localities is that place, as before. Search is never held back.
 */
export function HomeSearch({
  localities,
  projectsHref,
  aiSearchHref,
  layout = "wide",
}: HomeSearchProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const places = usePlaceSuggestions(text);
  const panel = usePlacePanel(places.state, text);
  const popular = useMemo(() => popularLinks(localities), [localities]);
  const quickPicks = useMemo(() => quickPickLinks(), []);

  return (
    <SearchCard
      layout={layout}
      projectsHref={projectsHref}
      aiSearchHref={aiSearchHref}
      localityOptions={places.options}
      localityLoading={places.state === "loading"}
      localityMinChars={PLACE_MIN_CHARACTERS}
      localityPanel={panel}
      onLocalityTextChange={setText}
      onLocalityQueryChange={places.search}
      onLocalitySelect={places.pick}
      popular={popular}
      quickPickHrefs={quickPicks}
      onSearch={(values) => router.push(searchHrefFromCard(values, localities, places.picked))}
    />
  );
}
