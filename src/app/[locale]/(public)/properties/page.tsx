import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PropertyCard } from "@/components/domain/property-card";
import { SponsorSlot } from "@/components/layout/sponsor-slot";
import { CompareCardToggle } from "@/features/compare";
import { toPropertyCard } from "@/features/home";
import {
  canonicalRedirect,
  getSearchResults,
  parseSearchParams,
  ResultsScreen,
} from "@/features/search";
import { getFeatureFlags, getSiteSettings, getSponsorAds, getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import { RESULTS_SPONSOR_AFTER, selectSponsors } from "@/lib/sponsors";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("results.metaTitle") };
}

/** The first cards are above the fold on every width, so their pictures load at once. */
const PRIORITY_CARDS = 3;

/**
 * The results page (S4-T04, ADR-042). The address is the search (frontend.md 6.1): it is read with
 * the rules of the contract, a hand-edited address is sent to its canonical form, one page of homes
 * is read through `search_properties()`, and the screen draws what it is given. Reading the address
 * makes the page dynamic, so `loading.tsx` stands in while it is on its way.
 */
export default async function PropertiesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const settings = await getSiteSettings();
  const params = parseSearchParams(raw, { bounds: settings.region.bounds });
  const canonical = canonicalRedirect(raw, params);
  if (canonical !== null) redirect(canonical);

  const [results, translate] = await Promise.all([getSearchResults(params), getTranslate()]);
  const flags = getFeatureFlags();
  const context = { translate, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL };
  const homes = results.status === "ok" ? results.homes : [];
  // One sponsored banner after the sixth home, only when one qualifies: no empty row, no gap (FR-PUB-03).
  const ads = await getSponsorAds();
  const showBanner =
    homes.length >= RESULTS_SPONSOR_AFTER &&
    selectSponsors({ ads, placement: "results", layout: "search_desk" }).sponsors.length > 0;
  const withBanner = (cards: ReactNode[]): ReactNode[] =>
    showBanner
      ? [
          ...cards.slice(0, RESULTS_SPONSOR_AFTER),
          <div key="sponsor" className="col-span-full">
            <SponsorSlot ads={ads} placement="results" />
          </div>,
          ...cards.slice(RESULTS_SPONSOR_AFTER),
        ]
      : cards;

  return (
    <main id="main" className="flex-1">
      <ResultsScreen
        params={params}
        status={results.status}
        total={results.status === "ok" ? results.total : 0}
        shown={homes.length}
        localities={settings.homepage.localities}
        regionName={settings.region.name}
        describeHref={flags.aiSearch ? "/ai-search" : undefined}
        cards={withBanner(
          homes.map((home, index) => {
            const property = toPropertyCard(home, context);
            return (
              <PropertyCard
                key={home.short_id}
                property={property}
                layout={params.view}
                priority={index < PRIORITY_CARDS}
                compare={
                  <CompareCardToggle
                    shortId={home.short_id}
                    title={home.title}
                    cover={property.cover?.src ?? null}
                  />
                }
              />
            );
          }),
        )}
      />
    </main>
  );
}
