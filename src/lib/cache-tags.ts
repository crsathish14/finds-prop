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
  /** The Blog: the article list, every article page, the sitemap's articles and the AI assistant's reads (ADR-143). */
  blog: "blog",
  /** The FAQ page, its structured data and the AI assistant's reads (ADR-143). */
  faq: "faq",
  /** The open jobs: the careers list, every job page, the sitemap's jobs and the AI assistant's reads (ADR-143). */
  careers: "careers",
} as const;

/** The tag of one home page, by its short id: a sold, rejected or edited home leaves it at once. */
export function propertyTag(shortId: string): string {
  return `property:${shortId}`;
}

/** The tag of one project page, by its slug. */
export function projectTag(slug: string): string {
  return `project:${slug}`;
}

/** The tag of one article, by its slug. */
export function blogPostTag(slug: string): string {
  return `blog-post:${slug}`;
}

/** The tag of one job page, by its slug. */
export function jobTag(slug: string): string {
  return `job:${slug}`;
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

/**
 * A builder was activated, deactivated or had their details saved (S7-T05): the projects list and each project page
 * (the builder's name and logo), and the homepage's developers, which leave the showcase with a deactivated builder.
 */
export function tagsAfterBuilderChange(): string[] {
  return [CACHE_TAGS.projects, CACHE_TAGS.homeProjects];
}

/** The site content was saved (FR-ADM-10). */
export function tagsAfterSiteSettingsChange(): string[] {
  return [CACHE_TAGS.siteSettings];
}

/** A form was created, edited, switched on or off, or moved to another placement (FR-ADM-08). */
export function tagsAfterFormChange(): string[] {
  return [CACHE_TAGS.forms];
}

/** An article was created, edited, published, unpublished, trashed or restored: the list, its own page and the sitemap (ADR-143). */
export function tagsAfterBlogChange(slug: string): string[] {
  return [CACHE_TAGS.blog, blogPostTag(slug)];
}

/** A question was created, edited, ordered, published, unpublished, trashed or restored (ADR-143). */
export function tagsAfterFaqChange(): string[] {
  return [CACHE_TAGS.faq];
}

/** A job was created, edited, opened, closed, trashed or restored: the list, its own page and the sitemap (ADR-143). */
export function tagsAfterJobChange(slug: string): string[] {
  return [CACHE_TAGS.careers, jobTag(slug)];
}

/** A category was added, renamed, ordered or switched off: it appears in every module that lists categories (ADR-143). */
export function tagsAfterContentCategoryChange(): string[] {
  return [CACHE_TAGS.blog, CACHE_TAGS.faq, CACHE_TAGS.careers];
}
