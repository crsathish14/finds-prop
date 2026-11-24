import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PropertyCard } from "@/components/domain/property-card";
import { FeaturedProjectCard } from "@/components/domain/featured-project-card";
import { getSelectedCity } from "@/features/cities";
import { CompareCardToggle } from "@/features/compare";
import { SaveHomeButton } from "@/features/saved";
import { toPropertyCard } from "@/features/home";
import {
  canonicalRedirect,
  canonicalSearchHref,
  getSearchResults,
  NEARBY_RADIUS_KM,
  nearbyHomesToShow,
  nearbySearchParams,
  parseSearchParams,
  ResultsScreen,
  resultsMeta,
  type ListingRow,
  searchRadiusKm,
  wantsNearby,
} from "@/features/search";
import { isSignedOut, LoginWallScreen, loginWallMetadata } from "@/features/login-wall";
import { pageMetadata } from "@/features/seo";
import { getFeatureFlags, getSiteSettings, getTranslate } from "@/features/site";
import { getFeaturedProject } from "@/features/sponsored";
import { publicEnv } from "@/lib/public-env";
import { RESULTS_SPONSOR_AFTER } from "@/lib/sponsors";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Each search has its own title and description, and one canonical address: its filters, without the
 * sort, the number shown or the view (FR-PUB-14).
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const [settings, translate, locale] = await Promise.all([
    getSiteSettings(),
    getTranslate(),
    getLocale(),
  ]);
  // A visitor who is not signed in gets one generic, unindexed title, whatever the filters say.
  if (await isSignedOut()) return loginWallMetadata(translate);
  const params = parseSearchParams(raw, { bounds: settings.region.bounds });
  const { title, description } = resultsMeta(params, translate, locale);
  return pageMetadata({
    title,
    description,
    path: canonicalSearchHref(params),
    siteName: translate("meta.title"),
  });
}

/** The first cards are above the fold on every width, so their pictures load at once. */
const PRIORITY_CARDS = 3;

/**
 * The results page (S4-T04, ADR-042). The address is the search (frontend.md 6.1): it is read with
 * the rules of the contract, a hand-edited address is sent to its canonical form, one page of homes
 * is read through `search_properties()`, and the screen draws what it is given. Reading the address
 * makes the page dynamic, so `loading.tsx` stands in while it is on its way. With a place and fewer
 * than NEARBY_THRESHOLD homes in its circle, the same filters are read once more in the 15 km circle,
 * nearest first, for the "Also near" section (ADR-137); the headline count and the list stay the
 * circle's own (FR-GEO-03).
 */
export default async function PropertiesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const settings = await getSiteSettings();
  const params = parseSearchParams(raw, { bounds: settings.region.bounds });
  const canonical = canonicalRedirect(raw, params);
  if (canonical !== null) redirect(canonical);

  // The list is for signed-in visitors (ADR-171): a visitor who is not signed in gets the wall and no read at
  // all. The phone sign-in is inside the wall, and after the code this same page, with this same search, draws
  // the list.
  if (await isSignedOut()) {
    return (
      <main id="main" className="flex-1 bg-canvas-sunken">
        <LoginWallScreen kind="properties" siteKey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </main>
    );
  }

  const [results, translate] = await Promise.all([getSearchResults(params), getTranslate()]);
  const flags = getFeatureFlags();
  const context = { translate, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL };
  const homes = results.status === "ok" ? results.homes : [];
  // The Featured project card after the sixth home (ADR-192): a project of a builder or agent the admin picked, the
  // searched area first, a different one on each visit. Only when one can show: no empty row, no gap (FR-PUB-03).
  const featured =
    homes.length >= RESULTS_SPONSOR_AFTER
      ? await getFeaturedProject({
          cityKey: (await getSelectedCity()).key,
          area: params.locality ?? params.place,
        })
      : null;
  const withBanner = (cards: ReactNode[]): ReactNode[] =>
    featured
      ? [
          ...cards.slice(0, RESULTS_SPONSOR_AFTER),
          <div key="sponsor" className="col-span-full">
            <FeaturedProjectCard project={featured} />
          </div>,
          ...cards.slice(RESULTS_SPONSOR_AFTER),
        ]
      : cards;

  // The wider read only for a place search whose circle holds few homes; a failure of it draws nothing.
  const wide =
    results.status === "ok" && wantsNearby(params, results.total)
      ? await getSearchResults(nearbySearchParams(params))
      : null;
  const nearbyHomes =
    wide?.status === "ok"
      ? nearbyHomesToShow({ main: homes, wide: wide.homes, radiusKm: searchRadiusKm(params) })
      : [];

  const card = (home: ListingRow, priority: boolean) => {
    const property = toPropertyCard(home, context);
    return (
      <PropertyCard
        key={home.short_id}
        property={property}
        layout={params.view}
        priority={priority}
        save={<SaveHomeButton shortId={home.short_id} />}
        compare={
          <CompareCardToggle
            shortId={home.short_id}
            title={home.title}
            cover={property.cover?.src ?? null}
          />
        }
      />
    );
  };

  return (
    <main id="main" className="flex-1 bg-canvas-sunken">
      <ResultsScreen
        params={params}
        status={results.status}
        total={results.status === "ok" ? results.total : 0}
        shown={homes.length}
        localities={settings.homepage.localities}
        regionName={settings.region.name}
        describeHref={flags.aiSearch ? "/ai-search" : undefined}
        cards={withBanner(homes.map((home, index) => card(home, index < PRIORITY_CARDS)))}
        nearby={
          nearbyHomes.length === 0
            ? undefined
            : {
                count: nearbyHomes.length,
                radiusKm: NEARBY_RADIUS_KM,
                cards: nearbyHomes.map((home) => card(home, false)),
              }
        }
      />
    </main>
  );
}
