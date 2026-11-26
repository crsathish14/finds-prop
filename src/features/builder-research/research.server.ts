import "server-only";
import {
  SERVER_RESEARCH_STORE,
  type ResearchStore,
  type SavedCopy,
} from "@/server/audit/builder-research";
import type { PageLink } from "./page-text";
import { pickPages, type BuilderPage, type CandidateLink } from "./pick-pages";
import {
  checkPage,
  readPage,
  readSiteFile,
  REAL_READER,
  type PageProblem,
  type ReaderDeps,
} from "./reader.server";
import { siteOf, pageKey } from "./site";
import { sitemapPages } from "./sitemap";
import { PAGE_TOPICS, type PageTopic, type QuestionTopic } from "./topics";

/**
 * Builder research for one buyer's question (AI search Phase 4, owner decisions 27 Nov 2026):
 *
 *  1. The builder's website and extra pages come from the profile; with no https website there is nothing to read.
 *  2. The home page and the extra pages are read first (their links are the candidates), with the site's robots.txt
 *     and sitemap.xml.
 *  3. `pickPages` chooses up to five pages for the question's topic; any not read yet are read.
 *  4. A page read in the last 7 days is taken from its saved copy instead of the website. Each page actually opened is
 *     saved again and logged, ok or with its problem.
 *
 * Network and storage go through `ResearchDeps`, so the tests give stand-ins.
 */

/** How long a saved copy is used (the database also removes older ones every night). */
export const COPY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** robots.txt is saved as text; more than this is not a robots file anyone writes by hand. */
const ROBOTS_MAX = 50_000;

export interface ResearchDeps {
  readonly reader: ReaderDeps;
  readonly store: ResearchStore;
  readonly now: () => Date;
}

const REAL_DEPS: ResearchDeps = {
  reader: REAL_READER,
  store: SERVER_RESEARCH_STORE,
  now: () => new Date(),
};

export interface ResearchedPage {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

export type ResearchResult =
  | { readonly ok: true; readonly pages: readonly ResearchedPage[] }
  | { readonly ok: false; readonly reason: "not_found" | "no_website" | "nothing_read" };

type Got = { readonly ok: true; readonly copy: SavedCopy } | { readonly ok: false };

function isPageTopic(value: string): value is PageTopic {
  return (PAGE_TOPICS as readonly string[]).includes(value);
}

/** The address of a site file of the website, such as its robots.txt. */
function siteFile(website: string, path: "/robots.txt" | "/sitemap.xml"): string {
  return new URL(path, website).toString();
}

export async function researchBuilder(
  input: { readonly builderId: string; readonly topic: QuestionTopic },
  deps: ResearchDeps = REAL_DEPS,
): Promise<ResearchResult> {
  const { builderId, topic } = input;
  const setup = await deps.store.setup(builderId);
  if (setup === null) return { ok: false, reason: "not_found" };
  const website = setup.website;
  if (website === null || siteOf(website) === null) return { ok: false, reason: "no_website" };
  const builderPages: BuilderPage[] = setup.pages.flatMap((page) =>
    isPageTopic(page.topic) ? [{ url: page.url, topic: page.topic }] : [],
  );

  const robotsUrl = siteFile(website, "/robots.txt");
  const sitemapUrl = siteFile(website, "/sitemap.xml");
  const firstUrls = [website, ...builderPages.map((page) => page.url)];
  const keyOf = (address: string) => pageKey(address) ?? address;
  const since = new Date(deps.now().getTime() - COPY_DAYS * DAY_MS);
  const saved = await deps.store.saved(
    builderId,
    [...new Set([robotsUrl, sitemapUrl, ...firstUrls].map(keyOf))],
    since,
  );

  // The site files: saved copies, or read now and saved (an empty copy is "none").
  const robotsCopy = saved.get(keyOf(robotsUrl));
  let robotsTxt: string | null;
  if (robotsCopy !== undefined) {
    robotsTxt = robotsCopy.body === "" ? null : robotsCopy.body;
  } else {
    robotsTxt = await readSiteFile("/robots.txt", website, deps.reader);
    await deps.store.save(builderId, keyOf(robotsUrl), {
      url: robotsUrl,
      title: "",
      body: (robotsTxt ?? "").slice(0, ROBOTS_MAX),
      links: [],
    });
  }

  const sitemapCopy = saved.get(keyOf(sitemapUrl));
  let sitemap: readonly string[];
  if (sitemapCopy !== undefined) {
    sitemap = sitemapCopy.links.map((link) => link.href);
  } else {
    const xml = await readSiteFile("/sitemap.xml", website, deps.reader);
    sitemap = xml === null ? [] : sitemapPages(xml, website);
    await deps.store.save(builderId, keyOf(sitemapUrl), {
      url: sitemapUrl,
      title: "",
      body: "",
      links: sitemap.map((href) => ({ href, text: "" })),
    });
  }

  // One page: its saved copy, or read now, saved and logged. Each page is fetched at most once per question.
  const fetched = new Map<string, Promise<Got>>();
  const get = (address: string): Promise<Got> => {
    const key = keyOf(address);
    const known = fetched.get(key);
    if (known !== undefined) return known;
    const copy = saved.get(key);
    const pending: Promise<Got> =
      copy !== undefined
        ? Promise.resolve({ ok: true, copy })
        : (async () => {
            const result = await readPage(address, website, robotsTxt, deps.reader);
            await deps.store.record(builderId, address, "read", result.ok ? null : result.problem);
            if (!result.ok) return { ok: false };
            const read: SavedCopy = {
              url: result.url,
              title: result.page.title,
              body: result.page.text,
              links: result.page.links,
            };
            await deps.store.save(builderId, key, read);
            return { ok: true, copy: read };
          })();
    fetched.set(key, pending);
    return pending;
  };

  const [home, ...extra] = await Promise.all(firstUrls.map(get));
  const linksFrom = (got: Got | undefined): readonly PageLink[] =>
    got !== undefined && got.ok ? got.copy.links : [];
  const candidates: CandidateLink[] = [
    ...linksFrom(home).map((link) => ({ href: link.href, text: link.text, from: "home" as const })),
    ...extra.flatMap((got) =>
      linksFrom(got).map((link) => ({
        href: link.href,
        text: link.text,
        from: "builder_page" as const,
      })),
    ),
    ...sitemap.map((href) => ({ href, text: "", from: "sitemap" as const })),
  ];

  const picked = pickPages({ topic, website, builderPages, candidates });
  // The picked pages not looked up yet may have saved copies too.
  const unknown = picked.map((page) => keyOf(page.url)).filter((key) => !fetched.has(key));
  for (const [key, copy] of await deps.store.saved(builderId, unknown, since)) saved.set(key, copy);
  const results = await Promise.all(picked.map((page) => get(page.url)));
  // The address is the one actually read (after any redirect), so the source the assistant names is exact.
  const pages = results.flatMap((got) =>
    got.ok ? [{ url: got.copy.url, title: got.copy.title, text: got.copy.body }] : [],
  );
  return pages.length === 0 ? { ok: false, reason: "nothing_read" } : { ok: true, pages };
}

/**
 * The check when a builder (or the admin) saves an extra page: can the reader use it? Logged as a check either way.
 * The website itself is never refused (the owner's rule): only the extra pages must be readable to be saved.
 */
export async function checkBuilderPage(
  input: { readonly builderId: string; readonly url: string; readonly website: string },
  deps: Pick<ResearchDeps, "reader" | "store"> = REAL_DEPS,
): Promise<
  { readonly readable: true } | { readonly readable: false; readonly problem: PageProblem }
> {
  const result = await checkPage(input.url, input.website, deps.reader);
  await deps.store.record(
    input.builderId,
    input.url,
    "check",
    result.readable ? null : result.problem,
  );
  return result;
}
