/**
 * The sections of the home page below the hero, in their built-in order (CR plan 5). The super admin can reorder them;
 * desktop and mobile share the one order. The hero always comes first and is not part of the list.
 */
export const HOME_SECTION_KEYS = [
  "discovery",
  "featured",
  "newLaunches",
  "spotlight",
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

/**
 * The order to render: the saved keys that are known (each once), then any section the saved list leaves out, in its
 * built-in place. So an unknown key is dropped, a repeat is ignored and a section added to the page later still
 * appears, at the end, instead of vanishing.
 */
export function resolveHomeOrder(saved?: readonly string[]): HomeSectionKey[] {
  const known = new Set<string>(HOME_SECTION_KEYS);
  const seen = new Set<HomeSectionKey>();
  for (const key of saved ?? []) {
    if (known.has(key)) seen.add(key as HomeSectionKey);
  }
  return [...seen, ...HOME_SECTION_KEYS.filter((key) => !seen.has(key))];
}
