import { describe, expect, it } from "vitest";
import { articleBreadcrumbs, articleDocument } from "../json-ld";
import { blogArticleMetadata, blogListMetadata } from "../metadata";
import {
  adminBlogHref,
  blogArticlePath,
  blogHref,
  parseAdminBlogParams,
  parseBlogSlug,
  parsePublicBlogParams,
} from "../page-params";
import type { BlogArticleView } from "../view";

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

describe("UT-blog-public-params: what /blog reads from the address (ADR-143)", () => {
  it("reads the words, category, tag and page, and leaves empty what is missing", () => {
    expect(parsePublicBlogParams({})).toEqual({ query: "", category: "", tag: "", page: 1 });
    expect(
      parsePublicBlogParams(address("q=%20stamp%20duty%20&category=guides&tag=home-loans&page=3")),
    ).toEqual({ query: "stamp duty", category: "guides", tag: "home-loans", page: 3 });
  });

  it("takes the first of a repeated parameter", () => {
    expect(parsePublicBlogParams(address("q=one&q=two&page=2&page=9"))).toMatchObject({
      query: "one",
      page: 2,
    });
  });

  it("drops a category or tag that is not a slug, and a search longer than the limit", () => {
    expect(parsePublicBlogParams({ category: "Not A Slug!" }).category).toBe("");
    expect(parsePublicBlogParams({ tag: "../etc" }).tag).toBe("");
    expect(parsePublicBlogParams(address(`q=${"x".repeat(201)}`)).query).toBe("");
    expect(parsePublicBlogParams(address(`q=${"x".repeat(200)}`)).query).toHaveLength(200);
  });

  it("reads a page that is not a whole number from one up as page 1", () => {
    for (const bad of ["0", "-2", "1.5", "abc", "99999999"]) {
      expect(parsePublicBlogParams({ page: bad }).page).toBe(1);
    }
  });

  it("builds the address of a choice, leaving out what is empty and page 1, and encoding the words", () => {
    expect(blogHref()).toBe("/blog");
    expect(blogHref({ page: 1 })).toBe("/blog");
    expect(blogHref({ category: "guides" })).toBe("/blog?category=guides");
    expect(blogHref({ query: "stamp duty", category: "guides", tag: "loans", page: 2 })).toBe(
      "/blog?q=stamp+duty&category=guides&tag=loans&page=2",
    );
    expect(blogHref({ query: "a&b=c" })).toBe("/blog?q=a%26b%3Dc");
    expect(blogArticlePath("stamp-duty")).toBe("/blog/stamp-duty");
  });

  it("accepts only an article address that is a slug", () => {
    expect(parseBlogSlug("stamp-duty-2")).toBe("stamp-duty-2");
    for (const bad of ["Stamp-Duty", "a", "-a-", "a--b", "a b", "../x", "x".repeat(121), ""]) {
      expect(parseBlogSlug(bad)).toBeNull();
    }
  });
});

describe("UT-blog-admin-params: what /admin/blog reads from the address (ADR-143)", () => {
  const ID = "00000000-0000-4000-a400-000000000001";

  it("reads the tab, category, words and page", () => {
    expect(parseAdminBlogParams({})).toEqual({ status: "all", category: "", query: "", page: 1 });
    expect(
      parseAdminBlogParams(
        address(`status=draft&category=${ID.toUpperCase()}&q=%20loan%20&page=4`),
      ),
    ).toEqual({ status: "draft", category: ID, query: "loan", page: 4 });
  });

  it("drops what does not fit instead of refusing it", () => {
    expect(
      parseAdminBlogParams(address(`status=deleted&category=nope&page=-1&q=${"x".repeat(101)}`)),
    ).toEqual({ status: "all", category: "", query: "", page: 1 });
  });

  it("builds the address of a choice with the defaults left out", () => {
    expect(adminBlogHref()).toBe("/admin/blog");
    expect(adminBlogHref({ status: "all", page: 1 })).toBe("/admin/blog");
    expect(adminBlogHref({ status: "trash", category: ID, query: "a b", page: 2 })).toBe(
      `/admin/blog?status=trash&category=${ID}&q=a+b&page=2`,
    );
  });
});

const ARTICLE: BlogArticleView = {
  id: "00000000-0000-4000-b500-0000000000a1",
  slug: "stamp-duty",
  title: "Stamp duty explained",
  excerpt: "What you pay besides the price.",
  coverUrl: "https://files.test/blog/cover.jpg",
  coverAlt: "A house",
  tags: ["home-loans", "chennai"],
  authorName: "Asha Rao",
  publishedAt: "2026-11-10T08:00:00+00:00",
  readMinutes: 3,
  body: [],
  categoryId: "c1",
  category: { slug: "guides", name: "Guides" },
  seoTitle: null,
  seoDescription: null,
  updatedAt: "2026-11-12T08:00:00+00:00",
};

const translate = ((key: string) => key) as never;

describe("UT-blog-metadata: the list and the article titles and canonical addresses (ADR-143, FR-PUB-14)", () => {
  it("gives the list one canonical address for its category, tag and page, and never for the words", () => {
    const base = blogListMetadata(translate, { query: "", category: "", tag: "", page: 1 });
    expect(base.alternates?.canonical).toBe("/blog");
    expect(base.robots).toBeUndefined();
    const filtered = blogListMetadata(translate, {
      query: "",
      category: "guides",
      tag: "loans",
      page: 2,
    });
    expect(filtered.alternates?.canonical).toBe("/blog?category=guides&tag=loans&page=2");
    expect(filtered.robots).toBeUndefined();
  });

  it("keeps a page found by free words out of the index but lets its links be followed", () => {
    const searched = blogListMetadata(translate, {
      query: "deed",
      category: "guides",
      tag: "",
      page: 1,
    });
    expect(searched.robots).toEqual({ index: false, follow: true });
    expect(searched.alternates?.canonical).toBe("/blog?category=guides");
  });

  it("uses the article's own title and summary, its cover as the share picture, and an article card", () => {
    const meta = blogArticleMetadata(translate, ARTICLE);
    expect(meta.title).toBe("Stamp duty explained");
    expect(meta.description).toBe("What you pay besides the price.");
    expect(meta.alternates?.canonical).toBe("/blog/stamp-duty");
    expect(meta.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-11-10T08:00:00+00:00",
      modifiedTime: "2026-11-12T08:00:00+00:00",
      authors: ["Asha Rao"],
      tags: ["home-loans", "chennai"],
      images: [{ url: "https://files.test/blog/cover.jpg", alt: "A house" }],
    });
  });

  it("prefers the search title and description the admin wrote, and falls back to the site's share image", () => {
    const meta = blogArticleMetadata(translate, {
      ...ARTICLE,
      seoTitle: " The search title ",
      seoDescription: "The search description.",
      coverUrl: null,
      coverAlt: null,
      tags: [],
      publishedAt: null,
    });
    expect(meta.title).toBe("The search title");
    expect(meta.description).toBe("The search description.");
    expect(meta.openGraph).not.toHaveProperty("tags");
    expect(meta.openGraph).not.toHaveProperty("publishedTime");
    expect(JSON.stringify(meta.openGraph?.images)).toContain("/share-image.png");
  });
});

describe("UT-blog-json-ld: the article's structured data (ADR-143, FR-PUB-14)", () => {
  it("is an Article with its headline, picture, dates, author, publisher and keywords", () => {
    const document = articleDocument(ARTICLE, {
      url: "https://findsprop.test/blog/stamp-duty",
      siteName: "Find Prop",
    });
    expect(document).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Stamp duty explained",
      description: "What you pay besides the price.",
      image: ["https://files.test/blog/cover.jpg"],
      datePublished: "2026-11-10T08:00:00+00:00",
      dateModified: "2026-11-12T08:00:00+00:00",
      keywords: "home-loans, chennai",
      articleSection: "Guides",
      author: { "@type": "Person", name: "Asha Rao" },
      publisher: { "@type": "Organization", name: "Find Prop" },
      mainEntityOfPage: { "@type": "WebPage", "@id": "https://findsprop.test/blog/stamp-duty" },
    });
  });

  it("says nothing about a picture, tags or a section the article does not have", () => {
    const document = articleDocument(
      { ...ARTICLE, coverUrl: null, tags: [], category: null, seoDescription: "Search words." },
      { url: "https://findsprop.test/blog/stamp-duty", siteName: "Find Prop" },
    );
    expect(document).not.toHaveProperty("image");
    expect(document).not.toHaveProperty("keywords");
    expect(document).not.toHaveProperty("articleSection");
    expect(document["description"]).toBe("Search words.");
  });

  it("is a trail of Home, Blog and the article with whole addresses", () => {
    const trail = articleBreadcrumbs({
      homeName: "Home",
      homeUrl: "https://findsprop.test/",
      blogName: "Blog",
      blogUrl: "https://findsprop.test/blog",
      title: "Stamp duty explained",
      url: "https://findsprop.test/blog/stamp-duty",
    });
    expect(trail["@type"]).toBe("BreadcrumbList");
    expect(trail["itemListElement"]).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://findsprop.test/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://findsprop.test/blog" },
      {
        "@type": "ListItem",
        position: 3,
        name: "Stamp duty explained",
        item: "https://findsprop.test/blog/stamp-duty",
      },
    ]);
  });
});
