"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SearchCard } from "@/components/domain/search-card";
import { searchHrefFromCard, type CuratedLocality } from "./from-card";
import { matchLocalities, popularLinks, quickPickLinks } from "./home-links";

type HomeSearchProps = {
  /** The curated localities of the site content (DEC-13): suggestions, and the Popular chips. */
  localities: readonly CuratedLocality[];
  projectsHref: string;
  /** Leave it out while AI search is off: the link is then not drawn. */
  aiSearchHref?: string | undefined;
  layout?: "wide" | "stacked";
};

/**
 * The search card of the homepage, joined to the results address: the visitor's choices become the
 * address of the results page (`searchHrefFromCard`) and the page opens. Locality suggestions are the
 * curated localities until the place search (S4-T05); any other text goes as a locality text match.
 */
export function HomeSearch({
  localities,
  projectsHref,
  aiSearchHref,
  layout = "wide",
}: HomeSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const options = useMemo(
    () =>
      matchLocalities(localities, query).map((place) => ({
        value: place.label,
        label: place.label,
      })),
    [localities, query],
  );
  const popular = useMemo(() => popularLinks(localities), [localities]);
  const quickPicks = useMemo(() => quickPickLinks(), []);

  return (
    <SearchCard
      layout={layout}
      projectsHref={projectsHref}
      aiSearchHref={aiSearchHref}
      localityOptions={options}
      onLocalityQueryChange={setQuery}
      localityMinChars={1}
      // The list is local, so there is nothing to wait for; a pause would let a suggestion that no
      // longer matches be picked by an Enter pressed straight after typing.
      localityDebounceMs={0}
      popular={popular}
      quickPickHrefs={quickPicks}
      onSearch={(values) => router.push(searchHrefFromCard(values, localities))}
    />
  );
}
