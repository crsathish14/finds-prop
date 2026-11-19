import type { SiteSettings } from "./schemas";

/**
 * The optional content modules the admin can switch on and off (ADR-143, FR-ADM-16). One list, so the pages, the
 * menus, the sitemap, the AI assistant's tools and the admin dashboard card all name the same three.
 */
export const CONTENT_MODULES = ["blog", "faq", "careers"] as const;
export type ContentModule = (typeof CONTENT_MODULES)[number];

/** True when the module is switched on in the site content. Pure, so a test or a client component can use it. */
export function isContentModuleOn(settings: SiteSettings, module: ContentModule): boolean {
  return settings.content_modules[module];
}
