import { onSameSite, pageAddress, pageKey } from "./site";

/**
 * The page addresses a site's `sitemap.xml` lists (AI search Phase 4): only `<url><loc>` entries on the same site, in
 * the file's order, at most `SITEMAP_PAGES_MAX`. A sitemap index (a list of more sitemaps) gives nothing: the reader goes
 * one step from the home page and no further. Pure.
 */

export const SITEMAP_PAGES_MAX = 200;

const URL_ENTRY = /<url\b[^>]*>[\s\S]*?<loc\b[^>]*>([\s\S]*?)<\/loc\s*>[\s\S]*?<\/url\s*>/gi;

function unescapeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export function sitemapPages(xml: string, website: string): string[] {
  const pages: string[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(URL_ENTRY)) {
    if (pages.length >= SITEMAP_PAGES_MAX) break;
    const address = pageAddress(unescapeXml(match[1] ?? ""));
    if (address === null || !onSameSite(address, website)) continue;
    const key = pageKey(address);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    pages.push(address);
  }
  return pages;
}
