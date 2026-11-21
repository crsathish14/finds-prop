import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_MAX_SOURCES_PER_ANSWER } from "@/config/ai";
import { isSourcePath, sourceHref, sourcesToShow } from "../source-links";
import type { SourceReference, ToolReference } from "../tools/types";

// UT-ai-source-links (ADR-143 section 6.5): the links under a content answer are built by code from ids a tool
// returned, and the browser draws only an address of those shapes.

const FAQ_ID = "f1000000-0000-4000-8000-000000000001";
const article = (slug: string, opened = false, id = `a-${slug}`): SourceReference => ({
  kind: "article",
  id,
  slug,
  title: `Title ${slug}`,
  opened,
});
const faq = (id: string, opened = false): SourceReference => ({
  kind: "faq",
  id,
  title: "A question",
  opened,
});

describe("UT-ai-source-links: the address of a source", () => {
  it("builds /blog/<slug> for an article, /faq#faq-<id> for a question and /careers/<slug> for a reserved job", () => {
    expect(sourceHref(article("registration-charges"))).toBe("/blog/registration-charges");
    expect(sourceHref(faq(FAQ_ID))).toBe(`/faq#faq-${FAQ_ID}`);
    expect(
      sourceHref({ kind: "job", slug: "site-engineer", title: "Site engineer", opened: false }),
    ).toBe("/careers/site-engineer");
  });

  it("builds nothing from an id or a slug that does not have the shape of one", () => {
    expect(sourceHref(article(""))).toBeNull();
    expect(sourceHref(article("Has Capitals"))).toBeNull();
    expect(sourceHref(article("../../admin"))).toBeNull();
    expect(sourceHref(article("a".repeat(121)))).toBeNull();
    expect(sourceHref(faq("not-a-uuid"))).toBeNull();
    expect(sourceHref(faq(`${FAQ_ID}#x`))).toBeNull();
  });

  it("accepts as a source path exactly the addresses it can build, and no other", () => {
    expect(isSourcePath("/blog/registration-charges")).toBe(true);
    expect(isSourcePath(`/faq#faq-${FAQ_ID}`)).toBe(true);
    expect(isSourcePath("/careers/site-engineer")).toBe(true);
    for (const path of [
      "/blog",
      "/blog/",
      "/blog/a/b",
      "/blog/UPPER",
      "//evil.example/blog/x",
      "https://evil.example/blog/x",
      "/faq",
      "/faq#other",
      "/faq#faq-x",
      "/admin/blog/x",
      "/properties/x",
    ]) {
      expect(isSourcePath(path), path).toBe(false);
    }
  });

  it("points at pages that exist: the FAQ page is a route of the app (the Blog and Careers pages are separate changes)", () => {
    const app = join(process.cwd(), "src", "app", "[locale]", "(public)");
    expect(existsSync(join(app, "faq", "page.tsx"))).toBe(true);
  });
});

describe("UT-ai-source-links: which sources an answer draws", () => {
  const home: ToolReference = { kind: "home", homeId: "k3x9a2bd", slug: "a-home" };

  it("draws the best matches of a search, in order, at most the cap", () => {
    const found = [article("a"), faq(FAQ_ID), article("c"), article("d"), article("e")];
    const shown = sourcesToShow([home, ...found]);
    expect(shown).toHaveLength(AI_MAX_SOURCES_PER_ANSWER);
    expect(shown.map((source) => source.kind)).toEqual(["article", "faq", "article"]);
  });

  it("draws only what the assistant read in full when it read something", () => {
    const shown = sourcesToShow([article("a"), article("b", true), faq(FAQ_ID), article("d")]);
    expect(shown.map((source) => (source.kind === "article" ? source.slug : source.kind))).toEqual([
      "b",
    ]);
  });

  it("leaves out a record whose address cannot be built, and draws nothing for homes and projects alone", () => {
    expect(sourcesToShow([article("Bad Slug"), faq("nope")])).toEqual([]);
    expect(sourcesToShow([home, { kind: "project", slug: "kadal-vista" }])).toEqual([]);
  });
});
