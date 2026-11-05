import type { SiteSettings } from "./schemas";

/**
 * What the site shows when `site_settings` is empty or a row is unusable (BR-81). No visitor-facing
 * wording is set here: headings, taglines and the region's words are content, chosen by the content
 * team in the CMS (DEC-14) or taken from the message catalogue by the page that shows them.
 */
export const SITE_DEFAULTS: SiteSettings = {
  header: { links: [] },
  footer: { links: [] },
  hero: { layout: "search_desk" },
  homepage: {
    showFeatured: true,
    showProjectTypes: true,
    showDiscovery: true,
    showWhyUs: true,
    showCta: true,
    localities: [],
  },
  // An approximate box around Tamil Nadu, used only to check that a place lies in the launch area.
  region: { bounds: { south: 8.0, west: 76.2, north: 13.6, east: 80.4 } },
  // No sponsored banners until the admin adds some (Stage 8): the page shows no banner and no gap.
  sponsors: { ads: [] },
};
