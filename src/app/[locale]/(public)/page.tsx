import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { HomeHero } from "@/components/domain/home-hero";
import { HomeSearchBar } from "@/components/domain/home-search-bar.client";
import {
  CityBrowseSection,
  CityHero,
  CtaSection,
  ExploreSection,
  CityFeaturedSection,
  CityNewestSection,
  CityNewLaunchesSection,
  WhySection,
} from "@/features/home";
import { SponsorSlot } from "@/components/layout/sponsor-slot";
import { SponsorStyledFrame } from "@/components/layout/sponsor-styled-frame";
import { HomeAiSearch } from "@/features/ai-chat";
import { ConversationalLive, HeroLabPreview, HeroLabSections } from "@/features/hero-lab";
import { SEARCH_PATH } from "@/features/search";
import { pageMetadata } from "@/features/seo";
import { resolveHero, selectStyled } from "@/lib/sponsors";
import { designLabEnabled } from "@/server/env";
import {
  buildHero,
  getFeatureFlags,
  getSiteSettings,
  getSponsorAds,
  getSponsorStyle,
  getTranslate,
  isRouteEnabled,
  resolveBrandName,
  resolveHomeOrder,
  type HomeSectionKey,
} from "@/features/site";

/** The homepage says what the site is, under the name alone, with its own canonical address (FR-PUB-14). */
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return pageMetadata({
    title: { absolute: translate("meta.title") },
    description: translate("meta.description"),
    path: "/",
    siteName: translate("meta.title"),
  });
}

/** Where the banner leads; the page leaves the banner out if the route is switched off. */
const POST_PROPERTY_PATH = "/post-property";

/**
 * The homepage: the hero, then the sections in the order the super admin chose (the order of the UX until they do). The site content can switch each
 * of Explore by locality, Featured homes, Browse by what matters, Why Find Prop and the banner off;
 * New launches and Newest have no switch and appear when there is something to show.
 * The words and settings come from the cached site content with the message catalogue as the
 * fallback, so the page needs no cookie and stays part of the static shell. The hero and the city
 * sections name the city the visitor chose in the header (a cookie), each behind its own Suspense
 * boundary. A section with nothing to show is left out whole, so no gap is left (FR-PUB-05).
 */
export default async function HomePage() {
  const translate = await getTranslate();
  const settings = await getSiteSettings();
  // The banner area: the Split layout needs a panel banner, and without one the page is Search Desk
  // with nothing in the banner position and no gap (FR-PUB-02, FR-PUB-03).
  const [ads, style] = await Promise.all([getSponsorAds(), getSponsorStyle()]);
  const arrangement = resolveHero(ads, settings.hero.layout);
  const split = arrangement.arrangement === "split";
  const conversational = arrangement.arrangement === "conversational";
  const eyebrow = settings.hero.eyebrow?.trim();
  const flags = getFeatureFlags();
  const { homepage } = settings;
  const showCta = homepage.showCta && isRouteEnabled(POST_PROPERTY_PATH, flags);
  const brandName = resolveBrandName(settings.header, translate);

  // Under the search bar (Search Desk, Conversational): the ads in the style the admin chose, only those ready for it
  // (ADR-190). Split keeps its picture panel. With nothing to show there is no ad and no gap.
  const styled = selectStyled(ads, style);
  const stripSponsor = split ? (
    arrangement.sponsors.length > 0 ? (
      <SponsorSlot ads={ads} placement="hero" layout="split" />
    ) : undefined
  ) : styled.length > 0 ? (
    <SponsorStyledFrame ads={styled} style={style} />
  ) : undefined;

  // The hero for the city in the header: the headline names it (buildHero), and the hero is the
  // Conversational one (ADR-177), the Split or the Search Desk, as the super admin chose.
  const heroFor = (cityName: string | undefined) => {
    const hero = buildHero(settings, translate, cityName);
    const liveHero = conversational ? (
      <ConversationalLive
        title={hero.title}
        emphasis={hero.emphasis}
        subtitle={hero.subtitle}
        aiSearch={flags.aiSearch}
        localities={homepage.localities}
        sponsor={stripSponsor}
        sponsorBare
      />
    ) : (
      <HomeHero
        title={hero.title}
        emphasis={hero.emphasis}
        subtitle={hero.subtitle}
        layout={split ? "split" : "search_desk"}
        eyebrow={split && eyebrow ? eyebrow : undefined}
        trust={
          split
            ? [
                translate("home.hero.trust.approved"),
                translate("home.hero.trust.enquire"),
                translate("home.hero.trust.compare"),
              ]
            : undefined
        }
        sponsor={stripSponsor}
      >
        {/* One search bar (ADR-150): the AI search while it is on, a keyword search of the results otherwise. */}
        {flags.aiSearch ? <HomeAiSearch /> : <HomeSearchBar mode="keyword" action={SEARCH_PATH} />}
      </HomeHero>
    );
    return { hero, liveHero };
  };

  // Each section below the hero; the super admin chooses their order (CR plan 5), one order for desktop and mobile.
  const sections: Record<HomeSectionKey, ReactNode> = {
    discovery: homepage.showDiscovery ? <ExploreSection localities={homepage.localities} /> : null,
    featured: homepage.showFeatured ? <CityFeaturedSection /> : null,
    newLaunches: <CityNewLaunchesSection />,
    projectTypes: homepage.showProjectTypes ? (
      <CityBrowseSection siteRegion={settings.region.name} />
    ) : null,
    newest: <CityNewestSection brandName={brandName} />,
    whyUs: homepage.showWhyUs ? <WhySection brandName={brandName} /> : null,
    cta: showCta ? <CtaSection href={POST_PROPERTY_PATH} /> : null,
  };
  const order = resolveHomeOrder(homepage.order);

  return (
    <main id="main" className="flex-1">
      <CityHero
        siteRegion={settings.region.name}
        render={(cityName) => {
          const { hero, liveHero } = heroFor(cityName);
          // The hero lab (preview only, never in production): the live hero plus the other layouts and the
          // experimental D, compared with a floating switch or ?layout=a|b|c|d. The live hero is shown until one is picked.
          if (!designLabEnabled) return liveHero;
          return (
            <HeroLabPreview
              live={split ? "split" : conversational ? "conversational" : "desk"}
              liveHero={liveHero}
              title={hero.title}
              emphasis={hero.emphasis}
              subtitle={hero.subtitle}
              eyebrow={eyebrow || undefined}
              ads={ads}
              aiSearch={flags.aiSearch}
              localities={homepage.localities}
            />
          );
        }}
      />
      {designLabEnabled ? (
        <HeroLabSections
          sections={order
            .map((key) => ({ key, node: sections[key] }))
            .filter((section) => section.node !== null)}
        />
      ) : (
        order.map((key) => <Fragment key={key}>{sections[key]}</Fragment>)
      )}
    </main>
  );
}
