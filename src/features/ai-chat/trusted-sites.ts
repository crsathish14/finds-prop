/**
 * The websites of the web search's trusted list (ADR-218) as the chat may link them (owner, 28 Nov 2026). No server-only
 * code: the output check and the chat island both use it, so the browser draws a link only to an address the server
 * would have let through.
 *
 * - A web source (`kind: "web"`) is a page the search read: drawn in the Sources row when it is a plain https address on
 *   a trusted domain or one of its subdomains.
 * - A trusted website's home address written in the answer (the website alone, such as `rera.tn.gov.in`) may always be
 *   written, and the chat draws it as a link to `https://<website>`. A page path is never made into a link this way.
 */
import { WEB_SEARCH_TRUSTED_DOMAINS } from "@/config/web-search";

/** The longest page address a web source may have, as `search_web` keeps it. */
const WEB_SOURCE_MAX_CHARACTERS = 300;

/** Whether a host (lower case, without `www.`) is a trusted domain or a subdomain of one. */
export function isTrustedHost(host: string): boolean {
  if (host === "" || !/^[a-z0-9.-]+$/u.test(host)) return false;
  return WEB_SEARCH_TRUSTED_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

/**
 * Whether a written address (lower case, without the scheme, `www.` or a trailing slash) is the home address of a trusted
 * website: the website alone, with no path, query or anchor.
 */
export function isTrustedSiteHome(normalized: string): boolean {
  if (/[/?#:@\s]/u.test(normalized)) return false;
  return isTrustedHost(normalized);
}

/** The address of a web source as the chat may draw it: a plain https page on a trusted website, or null. */
export function webSourceHref(written: string): string | null {
  if (written.length > WEB_SOURCE_MAX_CHARACTERS) return null;
  try {
    const url = new URL(written);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    return isTrustedHost(host) ? url.href : null;
  } catch {
    return null;
  }
}

/** A trusted website's home address found in a text: where it is, and the link it becomes. */
export interface TrustedHomeMatch {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly href: string;
}

/** Dotted words with an optional scheme or `www.`, up to a space; the trailing full stop or bracket is not part of it. */
const ADDRESS =
  /(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\/?/giu;

/**
 * The trusted websites' home addresses written in an answer, in order, each with its link (`https://<website>`). An
 * address with a path, or on a website that is not trusted, is left as text.
 */
export function findTrustedHomes(text: string): TrustedHomeMatch[] {
  const found: TrustedHomeMatch[] = [];
  for (const match of text.matchAll(ADDRESS)) {
    const written = match[0];
    const start = match.index;
    const end = start + written.length;
    // Part of a longer address or an email: "rera.tn.gov.in/x", "name@sbi.bank.in".
    const before = text.charAt(start - 1);
    const after = text.charAt(end);
    if (before === "@" || before === "/" || /[\p{L}\p{N}]/u.test(before)) continue;
    if (
      after === "/" ||
      after === "?" ||
      after === "#" ||
      after === "@" ||
      /[\p{L}\p{N}-]/u.test(after)
    ) {
      continue;
    }
    const host = written
      .toLowerCase()
      .replace(/^https?:\/\//u, "")
      .replace(/^www\./u, "")
      .replace(/\/$/u, "");
    if (!isTrustedSiteHome(host)) continue;
    found.push({ start, end, text: written, href: `https://${host}` });
  }
  return found;
}
