import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFooter,
  buildHeader,
  buildHero,
  getCurrentYear,
  getFeatureFlags,
  getTranslate,
  mergeSiteSettings,
  type SiteSettings,
} from "@/features/site";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { EDITABLE_SETTINGS, type EditableSetting } from "./constants";
import {
  footerFormOf,
  headerFormOf,
  heroFormOf,
  homepageFormOf,
  standardFooterOf,
  standardHeaderOf,
  standardHeroOf,
  type FooterFormValues,
  type HeaderFormValues,
  type HeroFormValues,
  type HomepageFormValues,
  type StandardFooter,
  type StandardHeader,
  type StandardHero,
} from "./form";

/**
 * What the Site content pages start from (S7-T10, FR-ADM-10): the settings as the public site would show them (the
 * saved values over the built-in defaults, BR-81), and which of the four have been saved at all. Read as the
 * signed-in admin and never cached: `getSiteSettings` of the public side keeps its answer for minutes, and an editor
 * must open on what was last saved. A failed read throws, so the error page shows it.
 */
export interface SiteContent {
  settings: SiteSettings;
  saved: Record<EditableSetting, boolean>;
}

/** The same read for any client (the integration tests pass the admin's). */
export async function readSiteContent(supabase: SupabaseClient<Database>): Promise<SiteContent> {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) {
    logger.error("the site content could not be read for the editor", { errorCode: error.code });
    throw error;
  }
  const saved = Object.fromEntries(
    EDITABLE_SETTINGS.map((key) => [key, data.some((row) => row.key === key)]),
  ) as Record<EditableSetting, boolean>;
  return { settings: mergeSiteSettings(data, logger), saved };
}

export async function getSiteContent(): Promise<SiteContent> {
  return readSiteContent(await createServerSupabase());
}

export interface HeaderPage {
  initial: HeaderFormValues;
  standard: StandardHeader;
}

/**
 * What the Header page opens with: the saved header (or, where nothing is saved, the links and the button visitors see
 * today) and the standard header for the empty boxes and the picture. The standard one is worked out by the same
 * builder the public header uses, so the two cannot drift apart.
 */
export async function getHeaderPage(): Promise<HeaderPage> {
  const [{ settings }, translate] = await Promise.all([getSiteContent(), getTranslate()]);
  const standard = standardHeaderOf(buildHeader({ links: [] }, getFeatureFlags(), translate));
  return { initial: headerFormOf(settings.header, standard), standard };
}

export interface FooterPage {
  initial: FooterFormValues;
  standard: StandardFooter;
}

/** What the Footer page opens with, worked out the same way with `buildFooter` (the brand name is the saved header's). */
export async function getFooterPage(): Promise<FooterPage> {
  const [{ settings }, translate, year] = await Promise.all([
    getSiteContent(),
    getTranslate(),
    getCurrentYear(),
  ]);
  const standard = standardFooterOf(
    buildFooter(
      { header: settings.header, footer: { links: [] } },
      getFeatureFlags(),
      translate,
      year,
    ),
  );
  return { initial: footerFormOf(settings.footer, standard), standard };
}

export interface HeroPage {
  initial: HeroFormValues;
  standard: StandardHero;
}

/**
 * What the Hero page opens with: the saved hero, with the headline visitors see today in the headline box when none is
 * saved (the box cannot be left empty), and the standard headline and subtitle for the picture, worked out by the same
 * builder the home page uses.
 */
export async function getHeroPage(): Promise<HeroPage> {
  const [{ settings }, translate] = await Promise.all([getSiteContent(), getTranslate()]);
  const standard = standardHeroOf(
    buildHero({ ...settings, hero: { layout: settings.hero.layout } }, translate),
  );
  return { initial: heroFormOf(settings.hero, standard), standard };
}

export interface HomepagePage {
  initial: HomepageFormValues;
}

/** What the Homepage page opens with: the saved switches and localities (the defaults where nothing is saved). */
export async function getHomepagePage(): Promise<HomepagePage> {
  const { settings } = await getSiteContent();
  return { initial: homepageFormOf(settings.homepage) };
}
