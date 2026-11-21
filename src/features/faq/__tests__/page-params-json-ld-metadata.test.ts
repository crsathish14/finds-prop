import { describe, expect, it } from "vitest";
import { faqPageDocument } from "../json-ld";
import { faqMetadata } from "../metadata";
import { adminFaqHref, faqHref, parseAdminFaqParams, parsePublicFaqParams } from "../page-params";
import type { FaqView } from "../view";

/** A parsed address: the parameters as the page receives them. */
const address = (text: string): Record<string, string | string[]> => {
  const found: Record<string, string | string[]> = {};
  for (const [name, value] of new URLSearchParams(text)) {
    const before = found[name];
    found[name] =
      before === undefined ? value : [...(Array.isArray(before) ? before : [before]), value];
  }
  return found;
};

describe("UT-faq-public-params: what /faq reads from the address (ADR-143)", () => {
  it("reads the words and the category, trimmed, and leaves empty what is missing", () => {
    expect(parsePublicFaqParams({})).toEqual({ query: "", category: "" });
    expect(parsePublicFaqParams(address("q=%20%20sale%20deed%20&category=buyers"))).toEqual({
      query: "sale deed",
      category: "buyers",
    });
  });

  it("takes the first of a repeated parameter", () => {
    expect(parsePublicFaqParams(address("q=one&q=two&category=sellers&category=buyers"))).toEqual({
      query: "one",
      category: "sellers",
    });
  });

  it("drops a category that is not a slug, and a search longer than the limit", () => {
    expect(parsePublicFaqParams({ category: "Not A Slug!" }).category).toBe("");
    expect(parsePublicFaqParams({ category: "../etc" }).category).toBe("");
    expect(parsePublicFaqParams(address("q=" + "x".repeat(201))).query).toBe("");
    expect(parsePublicFaqParams(address("q=" + "x".repeat(200))).query).toHaveLength(200);
  });

  it("builds the address of a choice, leaving out what is empty and encoding the words", () => {
    expect(faqHref()).toBe("/faq");
    expect(faqHref({ category: "buyers" })).toBe("/faq?category=buyers");
    expect(faqHref({ query: "sale deed", category: "buyers" })).toBe(
      "/faq?category=buyers&q=sale+deed",
    );
    expect(faqHref({ query: "a&b=c" })).toBe("/faq?q=a%26b%3Dc");
  });
});

describe("UT-faq-admin-params: what /admin/faq reads from the address (ADR-143)", () => {
  const CATEGORY = "00000000-0000-4000-b400-000000000001";

  it("defaults to every question, no category, no words", () => {
    expect(parseAdminFaqParams({})).toEqual({ view: "all", category: "", query: "" });
  });

  it("accepts the four tabs, a category id in any case, and words", () => {
    expect(
      parseAdminFaqParams(address(`view=trash&category=${CATEGORY.toUpperCase()}&q=%20deed%20`)),
    ).toEqual({ view: "trash", category: CATEGORY, query: "deed" });
    for (const view of ["all", "published", "draft", "trash"]) {
      expect(parseAdminFaqParams({ view }).view).toBe(view);
    }
  });

  it("drops a tab that does not exist, a category that is not an id and words that are too long", () => {
    expect(parseAdminFaqParams({ view: "archived" }).view).toBe("all");
    expect(parseAdminFaqParams({ category: "buyers" }).category).toBe("");
    expect(parseAdminFaqParams(address("q=" + "x".repeat(101))).query).toBe("");
  });

  it("builds the address of a choice, leaving out the defaults", () => {
    expect(adminFaqHref()).toBe("/admin/faq");
    expect(adminFaqHref({ view: "all", category: "", query: "" })).toBe("/admin/faq");
    expect(adminFaqHref({ view: "draft", category: CATEGORY, query: "deed" })).toBe(
      `/admin/faq?view=draft&category=${CATEGORY}&q=deed`,
    );
  });
});

const view = (extra: Partial<FaqView> = {}): FaqView => ({
  id: "q1",
  categoryId: "c1",
  categorySlug: "buyers",
  categoryName: "Buyers",
  question: "How do I list my property?",
  answer: "Sign in first.\n\nThen choose Post a property.",
  sortOrder: 1,
  updatedAt: "2026-11-20T10:00:00Z",
  ...extra,
});

describe("UT-faq-json-ld: the FAQPage structured data (ADR-143, FR-PUB-14)", () => {
  it("has one Question with its accepted Answer for each question shown, in order", () => {
    const document = faqPageDocument([
      view(),
      view({ id: "q2", question: "Is posting free?", answer: "Yes." }),
    ]);
    expect(document).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I list my property?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sign in first.\n\nThen choose Post a property.",
          },
        },
        {
          "@type": "Question",
          name: "Is posting free?",
          acceptedAnswer: { "@type": "Answer", text: "Yes." },
        },
      ],
    });
  });

  it("carries the admin's text as it is, with no markup added", () => {
    const document = faqPageDocument([view({ answer: "<b>bold</b> & more" })]);
    const entity = (document["mainEntity"] as { acceptedAnswer: { text: string } }[])[0];
    expect(entity?.acceptedAnswer.text).toBe("<b>bold</b> & more");
  });
});

describe("UT-faq-metadata: title, canonical address and indexing (ADR-143)", () => {
  const translate = (key: string) => key;

  it("names the page, with /faq as its one canonical address, and indexes it", () => {
    const metadata = faqMetadata(translate, { query: "", category: "" });
    expect(metadata.title).toBe("faq.meta.title");
    expect(metadata.description).toBe("faq.meta.description");
    expect(metadata.alternates?.canonical).toBe("/faq");
    expect(metadata.robots).toBeUndefined();
  });

  it("points a search or a category at the same canonical address and keeps it out of the index", () => {
    for (const params of [
      { query: "deed", category: "" },
      { query: "", category: "buyers" },
      { query: "deed", category: "buyers" },
    ]) {
      const metadata = faqMetadata(translate, params);
      expect(metadata.alternates?.canonical).toBe("/faq");
      expect(metadata.robots).toEqual({ index: false, follow: true });
    }
  });
});
