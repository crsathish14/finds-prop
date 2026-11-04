import { HomeHero } from "@/components/domain/home-hero";
import { HomeSearch } from "@/features/search";
import { buildHero, getFeatureFlags, getSiteSettings, getTranslate } from "@/features/site";

/**
 * The homepage. For now it is the hero: the headline and the search card (S4-T06). The sections
 * below it follow in the next step. The words come from the site content (cached) with the message
 * catalogue as the fallback, so the page needs no cookie and stays part of the static shell.
 */
export default async function HomePage() {
  const translate = await getTranslate();
  const settings = await getSiteSettings();
  const hero = buildHero(settings, translate);
  const flags = getFeatureFlags();

  return (
    <main id="main" className="flex-1">
      <HomeHero title={hero.title} emphasis={hero.emphasis} subtitle={hero.subtitle}>
        <HomeSearch
          localities={settings.homepage.localities}
          projectsHref="/projects"
          aiSearchHref={flags.aiSearch ? "/ai-search" : undefined}
        />
      </HomeHero>
    </main>
  );
}
