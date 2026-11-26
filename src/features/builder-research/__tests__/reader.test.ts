import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkPage, readPage, READ_BYTES_MAX } = await import("../reader.server");

const SITE = "https://kadalhomes.example";
const WORDS = "Kadal Homes has delivered forty two projects across Chennai since 1998. ".repeat(5);
const PAGE = `<html><head><title>About</title></head><body><p>${WORDS}</p></body></html>`;

type Answer = { status?: number; type?: string; body?: string; location?: string; size?: number };

/** A stand-in network: each address answers as given; every address looks up to a public one. */
function network(answers: Record<string, Answer>, publicAddress = "93.184.216.34") {
  const calls: string[] = [];
  const deps = {
    lookup: vi.fn(async () => [publicAddress]),
    fetch: vi.fn(async (input: string | URL | Request) => {
      const address = String(input);
      calls.push(address);
      const answer = answers[address];
      if (answer === undefined) return new Response("missing", { status: 404 });
      const headers = new Headers();
      if (answer.type) headers.set("content-type", answer.type);
      if (answer.location) headers.set("location", answer.location);
      if (answer.size !== undefined) headers.set("content-length", String(answer.size));
      return new Response(answer.body ?? "", { status: answer.status ?? 200, headers });
    }) as unknown as typeof fetch,
  };
  return { deps, calls };
}

describe("UT-builder-research-reader: opening a builder's page safely", () => {
  it("reads a page of the builder's site and gives its words", async () => {
    const { deps } = network({
      [`${SITE}/about`]: { type: "text/html; charset=utf-8", body: PAGE },
    });
    const result = await readPage(`${SITE}/about`, SITE, null, deps);
    expect(result).toMatchObject({ ok: true, url: `${SITE}/about` });
    expect(result.ok && result.page.text).toContain("delivered forty two projects");
  });

  it("follows a redirect inside the site, and refuses one to another site without opening it", async () => {
    const inside = network({
      [`${SITE}/old`]: { status: 301, location: "/about" },
      [`${SITE}/about`]: { type: "text/html", body: PAGE },
    });
    expect(await readPage(`${SITE}/old`, SITE, null, inside.deps)).toMatchObject({ ok: true });
    const outside = network({
      [`${SITE}/old`]: { status: 302, location: "https://portal.example/x" },
    });
    expect(await readPage(`${SITE}/old`, SITE, null, outside.deps)).toEqual({
      ok: false,
      problem: "not_on_site",
    });
    expect(outside.calls).toEqual([`${SITE}/old`]);
  });

  it("refuses a site whose name leads to a private address, without fetching", async () => {
    const { deps, calls } = network(
      { [`${SITE}/about`]: { type: "text/html", body: PAGE } },
      "10.0.0.5",
    );
    expect(await readPage(`${SITE}/about`, SITE, null, deps)).toEqual({
      ok: false,
      problem: "could_not_open",
    });
    expect(calls).toEqual([]);
  });

  it("names each problem: blocked, not a page, too little text, missing, too large", async () => {
    const { deps } = network({
      [`${SITE}/pdf`]: { type: "application/pdf", body: "%PDF" },
      [`${SITE}/empty`]: {
        type: "text/html",
        body: "<div id=root></div><script>render()</script>",
      },
      [`${SITE}/huge`]: { type: "text/html", body: "x", size: READ_BYTES_MAX + 1 },
    });
    expect(await readPage(`${SITE}/about`, SITE, "User-agent: *\nDisallow: /about", deps)).toEqual({
      ok: false,
      problem: "blocked",
    });
    expect(await readPage(`${SITE}/pdf`, SITE, null, deps)).toEqual({
      ok: false,
      problem: "not_a_page",
    });
    expect(await readPage(`${SITE}/empty`, SITE, null, deps)).toEqual({
      ok: false,
      problem: "too_little_text",
    });
    expect(await readPage(`${SITE}/gone`, SITE, null, deps)).toEqual({
      ok: false,
      problem: "could_not_open",
    });
    expect(await readPage(`${SITE}/huge`, SITE, null, deps)).toEqual({
      ok: false,
      problem: "could_not_open",
    });
  });

  it("checks a page the builder saves, reading the site's robots.txt itself", async () => {
    const { deps } = network({
      [`${SITE}/robots.txt`]: { type: "text/plain", body: "User-agent: *\nDisallow: /private" },
      [`${SITE}/about`]: { type: "text/html", body: PAGE },
    });
    expect(await checkPage(`${SITE}/about`, SITE, deps)).toEqual({ readable: true });
    expect(await checkPage(`${SITE}/private`, SITE, deps)).toEqual({
      readable: false,
      problem: "blocked",
    });
    expect(await checkPage("https://portal.example/kadal", SITE, deps)).toEqual({
      readable: false,
      problem: "not_on_site",
    });
  });
});
