import "server-only";
import { assertSafeUrl, lookupHost, UnsafeUrlError, type HostLookup } from "@/server/outbound-url";
import { pageTextOf, type PageText } from "./page-text";
import { allowedByRobots, READER_NAME } from "./robots";
import { onSameSite } from "./site";

/**
 * The builder website reader (AI search Phase 4, owner decisions 27 Nov 2026). It opens one page of a builder's own
 * website and gives its plain text and links, or says why it could not:
 *
 * - only https pages of the builder's site (`onSameSite`), and only public addresses (`assertSafeUrl`, the check the
 *   CRM calls use), looked up again before every request;
 * - redirects are followed by hand, at most three, and only within the same site;
 * - the site's `robots.txt` is obeyed for our reader's name;
 * - 5 seconds and 1 MB at most; only HTML pages; nothing on the page is run.
 *
 * Network access goes through `ReaderDeps`, so the tests give a stand-in.
 */

/** Why a page could not be read. The same words go to the builder and the admin, and into the log. */
export type PageProblem =
  "not_on_site" | "could_not_open" | "blocked" | "not_a_page" | "too_little_text";

export const READ_TIMEOUT_MS = 5000;
export const READ_BYTES_MAX = 1_000_000;
const REDIRECTS_MAX = 3;
/** A page with less readable text than this, scripts not run, gives the assistant nothing to go on. */
export const PAGE_TEXT_MIN = 200;

export interface ReaderDeps {
  readonly fetch: typeof fetch;
  readonly lookup: HostLookup;
}

export const REAL_READER: ReaderDeps = { fetch: (...args) => fetch(...args), lookup: lookupHost };

export type ReadResult =
  | { readonly ok: true; readonly url: string; readonly page: PageText }
  | { readonly ok: false; readonly problem: PageProblem };

type Opened =
  | { readonly ok: true; readonly url: string; readonly body: string; readonly type: string }
  | { readonly ok: false; readonly problem: PageProblem };

/** The body as text, or null when it is larger than allowed (the rest is not downloaded). */
async function bodyWithin(response: Response, max: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

/** Opens an address of the website, following same-site redirects by hand. */
async function open(
  address: string,
  website: string,
  deps: ReaderDeps,
  accept: string,
): Promise<Opened> {
  let current = address;
  for (let hop = 0; hop <= REDIRECTS_MAX; hop += 1) {
    if (!onSameSite(current, website)) return { ok: false, problem: "not_on_site" };
    try {
      await assertSafeUrl(current, deps.lookup);
    } catch (error) {
      if (error instanceof UnsafeUrlError) return { ok: false, problem: "could_not_open" };
      throw error;
    }
    let response: Response;
    try {
      response = await deps.fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
        headers: { "user-agent": `${READER_NAME}/1.0`, accept },
      });
    } catch {
      return { ok: false, problem: "could_not_open" };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location === null) return { ok: false, problem: "could_not_open" };
      try {
        current = new URL(location, current).toString();
      } catch {
        return { ok: false, problem: "could_not_open" };
      }
      continue;
    }
    if (!response.ok) return { ok: false, problem: "could_not_open" };
    let body: string | null;
    try {
      body = await bodyWithin(response, READ_BYTES_MAX);
    } catch {
      return { ok: false, problem: "could_not_open" };
    }
    if (body === null) return { ok: false, problem: "could_not_open" };
    return { ok: true, url: current, body, type: response.headers.get("content-type") ?? "" };
  }
  return { ok: false, problem: "could_not_open" };
}

/** A text file of the site (`robots.txt`, `sitemap.xml`), or null when there is none or it cannot be read. */
export async function readSiteFile(
  path: "/robots.txt" | "/sitemap.xml",
  website: string,
  deps: ReaderDeps,
): Promise<string | null> {
  let address: string;
  try {
    address = new URL(path, website).toString();
  } catch {
    return null;
  }
  const opened = await open(
    address,
    website,
    deps,
    "text/plain, application/xml, text/xml, */*;q=0.1",
  );
  return opened.ok ? opened.body : null;
}

/**
 * Reads one page of the builder's website. `robotsTxt` is the site's robots.txt (null when it has none): the caller
 * reads it once for all the pages of one question.
 */
export async function readPage(
  address: string,
  website: string,
  robotsTxt: string | null,
  deps: ReaderDeps,
): Promise<ReadResult> {
  if (!onSameSite(address, website)) return { ok: false, problem: "not_on_site" };
  const target = new URL(address);
  if (!allowedByRobots(robotsTxt, `${target.pathname}${target.search}`)) {
    return { ok: false, problem: "blocked" };
  }
  const opened = await open(address, website, deps, "text/html, application/xhtml+xml");
  if (!opened.ok) return opened;
  if (!/text\/html|application\/xhtml\+xml/i.test(opened.type))
    return { ok: false, problem: "not_a_page" };
  const page = pageTextOf(opened.body, opened.url);
  if (page.text.length < PAGE_TEXT_MIN) return { ok: false, problem: "too_little_text" };
  return { ok: true, url: opened.url, page };
}

/** The check run when a builder saves a page: can the reader use it? Reads the site's robots.txt itself. */
export async function checkPage(
  address: string,
  website: string,
  deps: ReaderDeps = REAL_READER,
): Promise<
  { readonly readable: true } | { readonly readable: false; readonly problem: PageProblem }
> {
  if (!onSameSite(address, website)) return { readable: false, problem: "not_on_site" };
  const robotsTxt = await readSiteFile("/robots.txt", website, deps);
  const result = await readPage(address, website, robotsTxt, deps);
  return result.ok ? { readable: true } : { readable: false, problem: result.problem };
}
