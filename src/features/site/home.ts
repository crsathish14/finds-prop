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
 * The hero's words (S4-T06). What the content team wrote in the site settings is shown as given:
 * a headline set there has no copper word, since the site cannot know which word it would be.
 * Without one, the headline is the message catalogue's, which names the region (in copper) when the
 * settings have one, and stays region-neutral when they do not (DEC-14). The line under it is the
 * settings' or the catalogue's.
 */
export function buildHero(settings: SiteSettings, translate: Translate): HeroText {
  const subtitle = filled(settings.hero.subtitle) ?? translate("home.hero.subtitle");
  const custom = filled(settings.hero.title);
  if (custom) return { title: custom, subtitle };
  const region = filled(settings.region.name);
  if (region) {
    return {
      title: translate("home.hero.titleInRegion", { region }),
      emphasis: region,
      subtitle,
    };
  }
  return { title: translate("home.hero.title"), subtitle };
}
