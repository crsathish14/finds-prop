/**
 * The names of the cache tags, and which tags a change to public data must refresh (S4-T11, ADR-048).
 *
 * Every cached public read is tagged with one or more of these (`cacheTag` inside `"use cache"`).
 * Every action that changes public data (approving or editing a listing, a project, the site
 * content) lists the tags its change touches, built here, in its `invalidate` setting; the action
 * pipeline then refreshes them after the write (`updateTag`). Keeping the names and the "what does
 * this change touch" answers in one file means a new cached read cannot be forgotten: a test
 * (`IT-cache`) fails when a read uses a tag that no helper below refreshes.
 *
 * The first four names keep the values the first reads were built with, so nothing cached changes.
 */
export const CACHE_TAGS = {
  /** Every list of homes: the homepage sections, the results page, the sitemap, and each home page. */
  listings: "home-listings",
  /** The homepage's "New launches" developers. */
  homeProjects: "home-projects",
  /** The projects list and every project page, and the sitemap's projects. */
  projects: "projects",
  /** The site content: header, hero, footer, homepage switches, sponsors. */
  siteSettings: "site-settings",
  /** The forms a visitor fills in: the contact page's form (S5-T05). */
  forms: "forms",
} as const;

/** The tag of one home page, by its short id: a sold, rejected or edited home leaves it at once. */
export function propertyTag(shortId: string): string {
  return `property:${shortId}`;
}

/** The tag of one project page, by its slug. */
export function projectTag(slug: string): string {
  return `project:${slug}`;
}

/**
 * A home was approved, edited, sold, rented, rejected or taken down: every list of homes and its
 * own page. Search results are cached for minutes too (ADR-042), so they are refreshed the same way.
 */
export function tagsAfterListingChange(shortId: string): string[] {
  return [CACHE_TAGS.listings, propertyTag(shortId)];
}

/**
 * A project was approved, published, edited, or one of its units or price trend changed: the
 * projects list and sitemap, the project's own page, and the homepage's developers.
 */
export function tagsAfterProjectChange(slug: string): string[] {
  return [CACHE_TAGS.projects, projectTag(slug), CACHE_TAGS.homeProjects];
}

/** The site content was saved (FR-ADM-10). */
export function tagsAfterSiteSettingsChange(): string[] {
  return [CACHE_TAGS.siteSettings];
}

/** A form was created, edited, switched on or off, or moved to another placement (FR-ADM-08). */
export function tagsAfterFormChange(): string[] {
  return [CACHE_TAGS.forms];
}
