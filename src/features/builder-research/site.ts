/**
 * The "same website" rule of builder research: a page may be read only when it is https and on the host of the website
 * on the builder's profile, a leading `www.` ignored (the database's `save_builder_research_links` applies the same
 * rule). Pure.
 */

/** The site of an address: its host in lower case without a leading `www.`, or null when it is not an https address. */
export function siteOf(address: string): string | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "") return null;
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** True when the address is an https page of the same site as the website. */
export function onSameSite(address: string, website: string): boolean {
  const site = siteOf(website);
  return site !== null && siteOf(address) === site;
}

/**
 * The same page whatever its spelling: the site (no `www.`), the path without a closing `/`, and the query. Two
 * addresses with the same key are one page.
 */
export function pageKey(address: string): string | null {
  const site = siteOf(address);
  if (site === null) return null;
  const url = new URL(address);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  return `${site}${path}${url.search}`;
}

/**
 * The address as one page: no fragment, so `/about#team` and `/about` are the same page. Null when it is not an https
 * address.
 */
export function pageAddress(address: string, base?: string): string | null {
  let url: URL;
  try {
    url = base === undefined ? new URL(address) : new URL(address, base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.hash = "";
  return url.toString();
}
