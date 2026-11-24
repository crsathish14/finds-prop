import type { Translate } from "@/lib/format";
import type { SiteSettings } from "./schemas";

/** The words of the homepage hero: the headline, the part of it to set in copper, and the line under it. */
export interface HeroText {
  title: string;
  emphasis?: string;
  subtitle: string;
}

/** A setting an editor left empty or filled with spaces is the same as no setting (BR-81). */
function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The placeholder the content team types in the headline to put the city in (owner, 24 Nov). The page
 * fills it with the city the visitor chose in the header, or the site's region when none was chosen.
 */
export const HERO_CITY_PLACEHOLDER = "{city}";

/**
 * The hero's words (S4-T06). What the content team wrote in the site settings is shown as given:
 * a headline set there has no copper word, since the site cannot know which word it would be.
 * The one exception is the `{city}` placeholder, which takes the city name, and that name is set in
 * copper. Without a headline, the headline is the message catalogue's, which names the region (in
 * copper) when the settings have one, and stays region-neutral when they do not (DEC-14). The line
 * under it is the settings' or the catalogue's.
 * `cityName` is the city the visitor chose in the header (owner, 24 Nov): it names the region in
 * place of the site's region, and fills the `{city}` placeholder.
 */
export function buildHero(
  settings: SiteSettings,
  translate: Translate,
  cityName?: string | undefined,
): HeroText {
  const subtitle = filled(settings.hero.subtitle) ?? translate("home.hero.subtitle");
  const custom = filled(settings.hero.title);
  const region = filled(cityName) ?? filled(settings.region.name);
  if (custom && !custom.includes(HERO_CITY_PLACEHOLDER)) return { title: custom, subtitle };
  if (custom && region) {
    return {
      title: custom.split(HERO_CITY_PLACEHOLDER).join(region),
      emphasis: region,
      subtitle,
    };
  }
  if (region) {
    return {
      title: translate("home.hero.titleInRegion", { region }),
      emphasis: region,
      subtitle,
    };
  }
  return { title: translate("home.hero.title"), subtitle };
}
