import { tagsAfterSiteSettingsChange } from "@/lib/cache-tags";
import {
  footerInputSchema,
  headerInputSchema,
  heroInputSchema,
  homepageInputSchema,
} from "./schemas";
import { sponsorsInputSchema } from "./sponsor-schemas";

/**
 * How the admin's site content actions run, kept apart from the "use server" file so a test can build them
 * (S7-T10). Only a super admin may call them, and each save is limited with the admin's other edits (`admin_edit`,
 * 600 an hour: a long editing session is well inside it, a stuck script is not). No idempotency key: a save replaces
 * one setting with the value given, so repeating it changes nothing more. Every save refreshes the site content tag,
 * so the change shows on the public site straight away (FR-ADM-10). The database audits `site_settings` itself
 * (`cms.changed`, which setting and who, never its content), so there is no `audit` entry here.
 */
export const saveHeaderConfig = {
  name: "saveHeader",
  input: headerInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};

export const saveHeroConfig = {
  name: "saveHero",
  input: heroInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};

export const saveHomepageConfig = {
  name: "saveHomepage",
  input: homepageInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};

export const saveFooterConfig = {
  name: "saveFooter",
  input: footerInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};

/**
 * The sponsors save (S7-T11, FR-ADM-11): the whole list replaces the stored one, so the same limits and cache tag apply
 * (`admin_edit`, the site content tag). The pictures are checked against their files on the server (ADR-104).
 */
export const saveSponsorsConfig = {
  name: "saveSponsors",
  input: sponsorsInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};
