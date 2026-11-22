import { HOME_SECTION_KEYS, type HomeSectionKey } from "@/lib/home-sections";

export { HOME_SECTION_KEYS, type HomeSectionKey };

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
