/**
 * The sections of the home page below the hero, in their built-in order (CR plan 5). The super admin can reorder them;
 * desktop and mobile share the one order. The hero always comes first and is not part of the list.
 */
export const HOME_SECTION_KEYS = [
  "discovery",
  "featured",
  "newLaunches",
  "projectTypes",
  "newest",
  "whyUs",
  "cta",
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/**
 * The order to render: the saved keys that are known (each once), then any section the saved list leaves out, in its
 * built-in place order. So an unknown key is dropped, a duplicate is ignored and a section added to the page later
 * still appears, at the end, instead of vanishing.
 */
