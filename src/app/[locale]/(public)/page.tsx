import { HomeHero } from "@/components/domain/home-hero";
import {
  BrowseSection,
  CtaSection,
  ExploreSection,
  FeaturedSection,
  NewestSection,
  NewLaunchesSection,
  WhySection,
} from "@/features/home";
import { HomeSearch } from "@/features/search";
import {
  buildHero,
  getFeatureFlags,
  getSiteSettings,
  getTranslate,
  isRouteEnabled,
  resolveBrandName,
} from "@/features/site";

/** Where the banner leads; the page leaves the banner out if the route is switched off. */
const POST_PROPERTY_PATH = "/post-property";

/**
 * The homepage: the hero, then the sections in the order of the UX. The site content can switch each
 * of Explore by locality, Featured homes, Browse by what matters, Why Find Prop and the banner off;
 * New launches and Newest have no switch and appear when there is something to show.
 * The words and settings come from the cached site content with the message catalogue as the
 * fallback, so the page needs no cookie and stays part of the static shell. A section with nothing
 * to show is left out whole, so no gap is left (FR-PUB-05).
 */
export default async function HomePage() {
  const translate = await getTranslate();
  const settings = await getSiteSettings();
  const hero = buildHero(settings, translate);
  const flags = getFeatureFlags();
  const { homepage, region } = settings;
  const showCta = homepage.showCta && isRouteEnabled(POST_PROPERTY_PATH, flags);
  const brandName = resolveBrandName(settings.header, translate);

  return (
    <main id="main" className="flex-1">
      <HomeHero title={hero.title} emphasis={hero.emphasis} subtitle={hero.subtitle}>
        <HomeSearch
          localities={homepage.localities}
          projectsHref="/projects"
          aiSearchHref={flags.aiSearch ? "/ai-search" : undefined}
        />
      </HomeHero>
      {homepage.showDiscovery ? <ExploreSection localities={homepage.localities} /> : null}
      {homepage.showFeatured ? <FeaturedSection /> : null}
      <NewLaunchesSection />
      {homepage.showProjectTypes ? <BrowseSection regionName={region.name} /> : null}
      <NewestSection brandName={brandName} />
      {homepage.showWhyUs ? <WhySection brandName={brandName} /> : null}
      {showCta ? <CtaSection href={POST_PROPERTY_PATH} /> : null}
    </main>
  );
}
