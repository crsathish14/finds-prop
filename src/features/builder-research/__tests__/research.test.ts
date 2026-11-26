import { describe, expect, it, vi } from "vitest";
import type { ResearchStore, SavedCopy, StoredExtraPage } from "@/server/audit/builder-research";

vi.mock("server-only", () => ({}));
vi.mock("@/server/audit/builder-research", () => ({ SERVER_RESEARCH_STORE: {} }));

const { researchBuilder, checkBuilderPage, COPY_DAYS } = await import("../research.server");

const SITE = "https://kadalhomes.example";
const BUILDER = "00000000-0000-4000-b000-000000000001";
const WORDS = "Kadal Homes has delivered forty two projects across Chennai since 1998. ".repeat(5);
const page = (title: string, links = "") =>
  `<html><head><title>${title}</title></head><body><nav>${links}</nav><p>${title}. ${WORDS}</p></body></html>`;
const HOME = page(
  "Home",
  '<a href="/about-us">About us</a><a href="/our-projects">Our Projects</a><a href="/careers">Careers</a>',
);

/** A stand-in network: each address answers with HTML; anything else is a 404. */
function network(pages: Record<string, string>) {
  const calls: string[] = [];
  return {
    calls,
    reader: {
      lookup: vi.fn(async () => ["93.184.216.34"]),
      fetch: vi.fn(async (input: string | URL | Request) => {
        const address = String(input);
        calls.push(address);
        const body = pages[address];
        if (body === undefined) return new Response("missing", { status: 404 });
        return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
      }) as unknown as typeof fetch,
    },
  };
}

/** A stand-in store: copies kept in memory with the time they were saved. */
function memoryStore(
  website: string | null,
  extra: StoredExtraPage[] = [],
  clock: { now: Date } = { now: new Date() },
) {
  const copies = new Map<string, SavedCopy & { savedAt: Date }>();
  const log: Array<{ url: string; kind: string; problem: string | null }> = [];
  const store: ResearchStore = {
    setup: async (id) => (id === BUILDER ? { website, pages: extra } : null),
    saved: async (_id, keys, since) =>
      new Map(
        keys.flatMap((key) => {
          const copy = copies.get(key);
          return copy !== undefined && copy.savedAt >= since ? [[key, copy] as const] : [];
        }),
      ),
    save: async (_id, key, copy) => {
      copies.set(key, { ...copy, savedAt: clock.now });
    },
    record: async (_id, url, kind, problem) => {
      log.push({ url, kind, problem });
    },
  };
  return { store, copies, log, clock };
}

describe("UT-builder-research: reading a builder's site for a question", () => {
  it("reads the home page, picks the page for the topic, and saves and logs what it opened", async () => {
    const net = network({ [SITE]: HOME, [`${SITE}/about-us`]: page("About us") });
    const mem = memoryStore(SITE);
    const result = await researchBuilder(
      { builderId: BUILDER, topic: "about_company" },
      { reader: net.reader, store: mem.store, now: () => mem.clock.now },
    );
    expect(result.ok && result.pages.map((found) => found.url)).toEqual([SITE, `${SITE}/about-us`]);
    expect(result.ok && result.pages[1]?.text).toContain("delivered forty two projects");
    expect(mem.log).toEqual([
      { url: SITE, kind: "read", problem: null },
      { url: `${SITE}/about-us`, kind: "read", problem: null },
    ]);
    expect([...mem.copies.keys()].sort()).toEqual([
      "kadalhomes.example/",
      "kadalhomes.example/about-us",
      "kadalhomes.example/robots.txt",
      "kadalhomes.example/sitemap.xml",
    ]);
  });

  it("uses saved copies for 7 days, then reads the site again", async () => {
    const net = network({ [SITE]: HOME, [`${SITE}/about-us`]: page("About us") });
    const mem = memoryStore(SITE);
    const deps = { reader: net.reader, store: mem.store, now: () => mem.clock.now };
    await researchBuilder({ builderId: BUILDER, topic: "about_company" }, deps);
    const opened = net.calls.length;

    mem.clock.now = new Date(mem.clock.now.getTime() + (COPY_DAYS - 1) * 86_400_000);
    const again = await researchBuilder({ builderId: BUILDER, topic: "about_company" }, deps);
    expect(again.ok).toBe(true);
    expect(net.calls.length).toBe(opened);

    mem.clock.now = new Date(mem.clock.now.getTime() + 2 * 86_400_000);
    await researchBuilder({ builderId: BUILDER, topic: "about_company" }, deps);
    expect(net.calls.length).toBeGreaterThan(opened);
  });

  it("puts the builder's own page for the topic first, and logs a page that could not be read", async () => {
    const net = network({ [SITE]: HOME, [`${SITE}/our-projects`]: page("Our projects") });
    const mem = memoryStore(SITE, [
      { url: `${SITE}/awards`, topic: "awards_approvals" },
      { url: `${SITE}/delivered`, topic: "delivery_record" },
    ]);
    const result = await researchBuilder(
      { builderId: BUILDER, topic: "delivery_record" },
      { reader: net.reader, store: mem.store, now: () => mem.clock.now },
    );
    expect(result.ok && result.pages.map((found) => found.url)).toEqual([
      SITE,
      `${SITE}/our-projects`,
    ]);
    expect(mem.log).toContainEqual({
      url: `${SITE}/delivered`,
      kind: "read",
      problem: "could_not_open",
    });
  });

  it("reads nothing for a builder with no website, or no such builder", async () => {
    const net = network({});
    const none = memoryStore(null);
    const deps = { reader: net.reader, store: none.store, now: () => new Date() };
    expect(await researchBuilder({ builderId: BUILDER, topic: "general" }, deps)).toEqual({
      ok: false,
      reason: "no_website",
    });
    expect(
      await researchBuilder(
        { builderId: "00000000-0000-4000-b000-000000000009", topic: "general" },
        deps,
      ),
    ).toEqual({ ok: false, reason: "not_found" });
    expect(net.calls).toEqual([]);
  });

  it("says nothing was read when the site cannot be opened", async () => {
    const net = network({});
    const mem = memoryStore(SITE);
    expect(
      await researchBuilder(
        { builderId: BUILDER, topic: "projects" },
        { reader: net.reader, store: mem.store, now: () => new Date() },
      ),
    ).toEqual({ ok: false, reason: "nothing_read" });
  });
});

describe("UT-builder-research-check: checking a page when it is saved", () => {
  it("logs the check whatever the answer", async () => {
    const net = network({ [`${SITE}/about-us`]: page("About us") });
    const mem = memoryStore(SITE);
    const deps = { reader: net.reader, store: mem.store };
    expect(
      await checkBuilderPage({ builderId: BUILDER, url: `${SITE}/about-us`, website: SITE }, deps),
    ).toEqual({ readable: true });
    expect(
      await checkBuilderPage({ builderId: BUILDER, url: `${SITE}/gone`, website: SITE }, deps),
    ).toEqual({ readable: false, problem: "could_not_open" });
    expect(mem.log).toEqual([
      { url: `${SITE}/about-us`, kind: "check", problem: null },
      { url: `${SITE}/gone`, kind: "check", problem: "could_not_open" },
    ]);
  });
});
