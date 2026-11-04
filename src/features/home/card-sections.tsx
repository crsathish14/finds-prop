import { DeveloperCard } from "@/components/domain/developer-card";
import { HomeSection } from "@/components/domain/home-section";
import { PropertyCard } from "@/components/domain/property-card";
import { ScrollRow } from "@/components/domain/scroll-row";
import { SectionGrid } from "@/components/domain/section-grid";
import { SectionHead } from "@/components/domain/section-head";
import { Link } from "@/components/ui/link";
import { buildSearchHref } from "@/features/search";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import { toDeveloperCard, toPropertyCard } from "./cards";
import { getFeaturedHomes, getNewLaunchDevelopers, getNewestHomes } from "./queries";

/** The ids that name each section by its heading. */
const FEATURED_TITLE = "home-featured-title";
const NEW_LAUNCHES_TITLE = "home-new-launches-title";
const NEWEST_TITLE = "home-newest-title";

/** Where "See all projects" leads. */
const PROJECTS_PATH = "/projects";

/**
 * "Featured homes": the featured approved homes, newest first, as property cards. Without any (none
 * is featured, or the read failed) the section is not drawn, so no gap is left (FR-PUB-05). The cards
 * have no Save or Compare yet (S5-T01, S4-T02).
 */
export async function FeaturedSection() {
  const homes = await getFeaturedHomes();
  if (homes.length === 0) return null;
  const translate = await getTranslate();
  const context = { translate, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL };
  return (
    <HomeSection labelledBy={FEATURED_TITLE} spacing="tight">
      <SectionHead
        id={FEATURED_TITLE}
        title={translate("home.featured.title")}
        action={
          <Link href={buildSearchHref({ label: "featured" })} variant="arrow">
            {translate("home.featured.viewAll")}
          </Link>
        }
      />
      <SectionGrid variant="cards">
        {homes.map((home) => (
          <PropertyCard key={home.short_id} property={toPropertyCard(home, context)} />
        ))}
      </SectionGrid>
    </HomeSection>
  );
}

/**
 * "New launches from developers": three developers with approved, published projects, on the darker
 * band. It has no switch of its own: it appears when there is a developer to show (BR-42, BR-94).
 */
export async function NewLaunchesSection() {
  const developers = await getNewLaunchDevelopers();
  if (developers.length === 0) return null;
  const translate = await getTranslate();
  return (
    <HomeSection labelledBy={NEW_LAUNCHES_TITLE} tone="band">
      <SectionHead
        id={NEW_LAUNCHES_TITLE}
        title={translate("home.newLaunches.title")}
        description={translate("home.newLaunches.description")}
        action={
          <Link href={PROJECTS_PATH} variant="arrow">
            {translate("home.newLaunches.seeAll")}
          </Link>
        }
      />
      <SectionGrid variant="cards">
        {developers.map((developer, index) => (
          <DeveloperCard
            key={developer.builderId}
            developer={toDeveloperCard(developer, index, publicEnv.NEXT_PUBLIC_SUPABASE_URL)}
          />
        ))}
      </SectionGrid>
    </HomeSection>
  );
}

/**
 * "Newest on Find Prop": the newest approved homes in a row that scrolls sideways. It has no switch
 * of its own: it appears when there is a home to show.
 */
export async function NewestSection({ brandName }: { brandName: string }) {
  const homes = await getNewestHomes();
  if (homes.length === 0) return null;
  const translate = await getTranslate();
  const context = { translate, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL };
  return (
    <HomeSection labelledBy={NEWEST_TITLE} spacing="tight">
      <ScrollRow
        id={NEWEST_TITLE}
        title={translate("home.newest.title", { brandName })}
        label={translate("home.newest.label")}
      >
        {homes.map((home) => (
          <PropertyCard key={home.short_id} property={toPropertyCard(home, context)} />
        ))}
      </ScrollRow>
    </HomeSection>
  );
}
