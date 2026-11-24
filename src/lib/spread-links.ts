/**
 * The footer's link column rules (owner change, 26 Nov 2026): at most 6 links in a column, at most 3 columns, so at
 * most 18 links in all. Links are spread as evenly as possible, longer columns first: 7 links make 4 + 3, 13 make
 * 5 + 4 + 4, 18 make 6 + 6 + 6. Links past the 18th are not shown.
 */
export const FOOTER_LINKS_PER_COLUMN = 6;
export const FOOTER_MAX_COLUMNS = 3;
export const FOOTER_MAX_LINKS = FOOTER_LINKS_PER_COLUMN * FOOTER_MAX_COLUMNS;

export function spreadLinks<Item>(items: readonly Item[]): Item[][] {
  const shown = items.slice(0, FOOTER_MAX_LINKS);
  if (shown.length === 0) return [];
  const columnCount = Math.ceil(shown.length / FOOTER_LINKS_PER_COLUMN);
  const baseSize = Math.floor(shown.length / columnCount);
  const longerColumns = shown.length % columnCount;
  const columns: Item[][] = [];
  let start = 0;
  for (let index = 0; index < columnCount; index += 1) {
    const size = baseSize + (index < longerColumns ? 1 : 0);
    columns.push(shown.slice(start, start + size));
    start += size;
  }
  return columns;
}
