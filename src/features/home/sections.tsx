import { CategoryCard } from "@/components/domain/category-card";
import { CtaBand } from "@/components/domain/cta-band";
import { HomeSection } from "@/components/domain/home-section";
import { LocalityTile } from "@/components/domain/locality-tile";
import { SectionGrid } from "@/components/domain/section-grid";
import { SectionHead } from "@/components/domain/section-head";
import { ValueCard } from "@/components/domain/value-card";
import { Link } from "@/components/ui/link";
import { SEARCH_PATH, type CuratedLocality } from "@/features/search";
import { getTranslate } from "@/features/site";
import { buildBrowseCards, buildExploreTiles, buildValueCards } from "./static-sections";

/** The ids that name each section by its heading. */
const EXPLORE_TITLE = "home-explore-title";
const BROWSE_TITLE = "home-browse-title";
const WHY_TITLE = "home-why-title";
const CTA_TITLE = "home-cta-title";

/**
 * "Explore by locality": a tile for each curated locality, each leading to the homes around it. With
 * no curated locality the section is not drawn at all, so no gap is left (DEC-13, FR-PUB-05).
 */
export async function ExploreSection({ localities }: { localities: readonly CuratedLocality[] }) {
  const tiles = buildExploreTiles(localities);
  if (tiles.length === 0) return null;
  const translate = await getTranslate();
  return (
    <HomeSection labelledBy={EXPLORE_TITLE}>
      <SectionHead
        id={EXPLORE_TITLE}
        title={translate("home.explore.title")}
        action={
          <Link href={SEARCH_PATH} variant="arrow">
            {translate("home.explore.seeAll")}
          </Link>
        }
      />
      <SectionGrid variant="tiles">
        {tiles.map((tile) => (
          <LocalityTile key={tile.key} name={tile.name} href={tile.href} tint={tile.tint} />
        ))}
      </SectionGrid>
    </HomeSection>
  );
}

/** "Browse by what matters": Featured, Prime, Budget and By locality. */
export async function BrowseSection({ regionName }: { regionName?: string | undefined }) {
  const translate = await getTranslate();
  const cards = buildBrowseCards(translate, regionName);
  return (
    <HomeSection labelledBy={BROWSE_TITLE}>
      <SectionHead id={BROWSE_TITLE} title={translate("home.browse.title")} />
      <SectionGrid variant="categories">
        {cards.map((card) => (
          <CategoryCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            description={card.description}
            href={card.href}
            tint={card.tint}
          />
        ))}
      </SectionGrid>
    </HomeSection>
  );
}

/** "Why Find Prop": three reasons, with the brand name in copper in the heading. */
export async function WhySection({ brandName }: { brandName: string }) {
  const translate = await getTranslate();
  const cards = buildValueCards(translate, brandName);
  return (
    <HomeSection labelledBy={WHY_TITLE}>
      <SectionHead
        id={WHY_TITLE}
        title={translate("home.why.title", { brandName })}
        emphasis={brandName}
      />
      <SectionGrid variant="values">
        {cards.map((card) => (
          <ValueCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            description={card.description}
          />
        ))}
      </SectionGrid>
    </HomeSection>
  );
}

/** The banner that invites a visitor to post a property. */
export async function CtaSection({ href }: { href: string }) {
  const translate = await getTranslate();
  return (
    <HomeSection labelledBy={CTA_TITLE} spacing="tight">
      <CtaBand
        id={CTA_TITLE}
        title={translate("home.cta.title")}
        description={translate("home.cta.description")}
        actionLabel={translate("home.cta.action")}
        href={href}
      />
    </HomeSection>
  );
}
