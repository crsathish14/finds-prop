/**
 * The pages the assistant may point a customer to when the website can do something the chat cannot (post a home,
 * manage a listing, sign in, open the dashboard, saved or compared homes, the builder sign-in, contact). The model
 * never writes a path or a web address: it writes the marker `[[link:KEY]]` with a KEY from this table, the output
 * check (`guards/output.ts`) accepts only these keys, and the endpoint turns an accepted key into a button with the
 * label from `en.json` (`ai.siteLinks.<key>`) and the path from here. A path outside this table can never reach
 * the screen. The tests check each path against a real route of the app.
 */

export const SITE_LINKS = {
  /** Post a home for sale or rent (the posting wizard). */
  post_property: { path: "/post-property", labelKey: "ai.siteLinks.post_property" },
  /** The customer's own listings: edit, pause, resubmit and see enquiries. */
  my_listings: { path: "/dashboard?tab=listings", labelKey: "ai.siteLinks.my_listings" },
  /** Saved homes. */
  saved_homes: { path: "/dashboard?tab=saved", labelKey: "ai.siteLinks.saved_homes" },
  /** Enquiries the customer received and sent. */
  enquiries: { path: "/dashboard?tab=sent", labelKey: "ai.siteLinks.enquiries" },
  /** The customer's dashboard. */
  dashboard: { path: "/dashboard", labelKey: "ai.siteLinks.dashboard" },
  /** Sign in or register with a mobile number. */
  sign_in: { path: "/auth", labelKey: "ai.siteLinks.sign_in" },
  /** Compare the homes the customer ticked. */
  compare: { path: "/compare", labelKey: "ai.siteLinks.compare" },
  /** Builder sign-in, for builder and project forms. */
  builder_sign_in: { path: "/builder/login", labelKey: "ai.siteLinks.builder_sign_in" },
  /** The projects list. */
  projects: { path: "/projects", labelKey: "ai.siteLinks.projects" },
  /** Contact the findsprop team. */
  contact: { path: "/contact", labelKey: "ai.siteLinks.contact" },
} as const;

export type SiteLinkKey = keyof typeof SITE_LINKS;

export const SITE_LINK_KEYS = Object.keys(SITE_LINKS) as SiteLinkKey[];

/** The most buttons one answer carries. */
export const MAX_SITE_LINKS_PER_ANSWER = 2;

export function isSiteLinkKey(value: string): value is SiteLinkKey {
  return Object.hasOwn(SITE_LINKS, value);
}

/** True only for a path that is in the table, so the browser draws no other server-offered link as a site button. */
export function isSiteLinkPath(path: string): boolean {
  return SITE_LINK_KEYS.some((key) => SITE_LINKS[key].path === path);
}

/** The marker the prompt teaches. */
export const SITE_LINK_MARKER = "[[link:KEY]]";
