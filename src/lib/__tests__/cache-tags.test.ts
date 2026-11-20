import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blogPostTag,
  CACHE_TAGS,
  jobTag,
  projectTag,
  propertyTag,
  tagsAfterBlogChange,
  tagsAfterBuilderChange,
  tagsAfterContentCategoryChange,
  tagsAfterFaqChange,
  tagsAfterFormChange,
  tagsAfterJobChange,
  tagsAfterListingChange,
  tagsAfterProjectChange,
  tagsAfterSiteSettingsChange,
} from "../cache-tags";

// IT-cache (S4-T11, ADR-048, R-BE-11): what a change to public data must refresh, and a scan that no
// cached read uses a tag nobody refreshes. A real eviction needs a running app and a database, so
// that part is not tested here; this proves the lists and the wiring that decide it.

describe("IT-cache: the names", () => {
  it("keeps the names the first reads were built with, and adds the forms and content module names", () => {
    expect(CACHE_TAGS).toEqual({
      listings: "home-listings",
      homeProjects: "home-projects",
      projects: "projects",
      siteSettings: "site-settings",
      forms: "forms",
      blog: "blog",
      faq: "faq",
      careers: "careers",
    });
  });

  it("names one home page and one project page", () => {
    expect(propertyTag("k3x9a2bd")).toBe("property:k3x9a2bd");
    expect(projectTag("kadal-vista")).toBe("project:kadal-vista");
  });
});

describe("IT-cache: what a change refreshes", () => {
  it("a home that is approved, edited, sold, rented, rejected or taken down leaves every list and its own page", () => {
    expect(tagsAfterListingChange("k3x9a2bd")).toEqual(["home-listings", "property:k3x9a2bd"]);
  });

  it("a project change refreshes the list, its own page and the homepage developers", () => {
    expect(tagsAfterProjectChange("kadal-vista")).toEqual([
      "projects",
      "project:kadal-vista",
      "home-projects",
    ]);
  });

  it("a site content save refreshes the site content", () => {
    expect(tagsAfterSiteSettingsChange()).toEqual(["site-settings"]);
  });

  it("a form change refreshes the forms", () => {
    expect(tagsAfterFormChange()).toEqual(["forms"]);
  });

  it("two homes never share a page tag", () => {
    expect(tagsAfterListingChange("aaaaaaaa")).not.toContain(propertyTag("bbbbbbbb"));
    expect(tagsAfterProjectChange("one")).not.toContain(projectTag("two"));
  });
});

/** The source files of the app (not tests), as text. */
function sourceFiles(directory: string): { file: string; text: string }[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [{ file: path, text: readFileSync(path, "utf8") }];
  });
}

/** The text between the brackets of every `cacheTag(...)` call in a file. */
function cacheTagArguments(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\bcacheTag\(/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (end < text.length && depth > 0) {
      if (text[end] === "(") depth += 1;
      if (text[end] === ")") depth -= 1;
      end += 1;
    }
    found.push(text.slice(start, end - 1));
  }
  return found;
}

describe("IT-cache: every cached read is tagged with a tag a change refreshes", () => {
  const SOURCE = sourceFiles(join(process.cwd(), "src"));
  const CALLS = SOURCE.flatMap(({ file, text }) =>
    cacheTagArguments(text).map((argument) => ({ file, argument })),
  );

  /** The tag constants a read may use, by the name it imports them under. */
  const KNOWN_NAMES: Record<string, string> = {
    LISTINGS_TAG: CACHE_TAGS.listings,
    HOME_LISTINGS_TAG: CACHE_TAGS.listings,
    HOME_PROJECTS_TAG: CACHE_TAGS.homeProjects,
    PROJECTS_TAG: CACHE_TAGS.projects,
    SITE_SETTINGS_TAG: CACHE_TAGS.siteSettings,
    FORMS_TAG: CACHE_TAGS.forms,
  };

  /** What the helpers refresh, whatever the page. */
  const REFRESHED = new Set([
    ...tagsAfterListingChange("x").map((tag) => tag.replace(/:.*/, ":")),
    ...tagsAfterProjectChange("x").map((tag) => tag.replace(/:.*/, ":")),
    ...tagsAfterBlogChange("x").map((tag) => tag.replace(/:.*/, ":")),
    ...tagsAfterSiteSettingsChange(),
    ...tagsAfterFormChange(),
    ...tagsAfterContentCategoryChange(),
  ]);

  it("finds the cached reads", () => {
    expect(CALLS.length).toBeGreaterThanOrEqual(10);
  });

  it("uses only the central tags, and every one of them is refreshed by a helper", () => {
    for (const { file, argument } of CALLS) {
      for (const part of argument.split(/,(?![^(]*\))/).map((piece) => piece.trim())) {
        if (part === "") continue;
        const known = KNOWN_NAMES[part];
        if (known !== undefined) {
          expect(REFRESHED, `${file}: ${part}`).toContain(known);
        } else if (/^propertyTag\(/.test(part)) {
          expect(REFRESHED, `${file}: ${part}`).toContain("property:");
        } else if (/^projectTag\(/.test(part)) {
          expect(REFRESHED, `${file}: ${part}`).toContain("project:");
        } else if (/^blogPostTag\(/.test(part)) {
          expect(REFRESHED, `${file}: ${part}`).toContain("blog-post:");
        } else if (/^CACHE_TAGS\.(blog|faq|careers)$/.test(part)) {
          // a content module's own tag: its list, its pages and the AI assistant's reads (ADR-143)
          const name = part.replace("CACHE_TAGS.", "") as "blog" | "faq" | "careers";
          expect(REFRESHED, `${file}: ${part}`).toContain(CACHE_TAGS[name]);
        } else if (/^categoryTag\(/.test(part)) {
          // a content category list is tagged blog, faq or careers, and a category change refreshes all three
          for (const tag of [CACHE_TAGS.blog, CACHE_TAGS.faq, CACHE_TAGS.careers]) {
            expect(REFRESHED, `${file}: ${part}`).toContain(tag);
          }
        } else {
          expect.fail(`${file}: cacheTag(${part}) is not a central tag (src/lib/cache-tags.ts)`);
        }
      }
    }
  });

  it("every central tag is used by at least one cached read", () => {
    const used = new Set(
      CALLS.flatMap(({ argument }) => argument.split(",").map((piece) => piece.trim())),
    );
    for (const name of Object.keys(KNOWN_NAMES)) {
      if (name === "HOME_LISTINGS_TAG") continue; // the same tag as LISTINGS_TAG under another name
      expect(used, name).toContain(name);
    }
    expect([...used].some((piece) => piece.startsWith("propertyTag("))).toBe(true);
    expect([...used].some((piece) => piece.startsWith("projectTag("))).toBe(true);
  });
});

describe("IT-cache: what a change to a builder refreshes (S7-T05)", () => {
  it("refreshes the projects and the homepage's developers, because a deactivated builder leaves the showcase", () => {
    expect(tagsAfterBuilderChange()).toEqual([CACHE_TAGS.projects, CACHE_TAGS.homeProjects]);
  });
});

describe("IT-cache: what a change to the content modules refreshes (ADR-143)", () => {
  it("an article change refreshes the Blog and that article's page", () => {
    expect(tagsAfterBlogChange("buying-guide")).toEqual(["blog", "blog-post:buying-guide"]);
    expect(blogPostTag("buying-guide")).toBe("blog-post:buying-guide");
  });

  it("a question change refreshes the FAQ", () => {
    expect(tagsAfterFaqChange()).toEqual(["faq"]);
  });

  it("a job change refreshes the careers list and that job's page", () => {
    expect(tagsAfterJobChange("site-engineer")).toEqual(["careers", "job:site-engineer"]);
    expect(jobTag("site-engineer")).toBe("job:site-engineer");
  });

  it("a category change refreshes every module that lists categories", () => {
    expect(tagsAfterContentCategoryChange()).toEqual(["blog", "faq", "careers"]);
  });

  it("two articles never share a page tag", () => {
    expect(tagsAfterBlogChange("one")).not.toContain(blogPostTag("two"));
    expect(tagsAfterJobChange("one")).not.toContain(jobTag("two"));
  });
});
