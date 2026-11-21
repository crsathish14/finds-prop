// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogArticleScreen } from "../blog-article-screen";
import { BlogListScreen } from "../blog-list-screen";
import { BlogShareLinks } from "../blog-share-links";
import { BlogArticleSkeleton, BlogListSkeleton } from "../blog-skeleton";
import type { BlogPageData } from "../queries";
import type { BlogArticleView, BlogCardView } from "../view";

const words = en.blog.page;

const card = (slug: string, extra: Partial<BlogCardView> = {}): BlogCardView => ({
  id: `id-${slug}`,
  slug,
  title: `Title of ${slug}`,
  excerpt: `Summary of ${slug}.`,
  snippet: null,
  coverUrl: null,
  coverAlt: null,
  category: { slug: "guides", name: "Guides" },
  tags: [],
  authorName: "Asha Rao",
  publishedAt: "2026-11-10T08:00:00+00:00",
  readMinutes: 4,
  ...extra,
});

const DATA: BlogPageData = {
  list: {
    items: [card("one"), card("two", { snippet: "A [[stamp]] duty guide" })],
    total: 30,
    page: 2,
    pageSize: 12,
    pageCount: 3,
  },
  categories: [
    { slug: "guides", name: "Guides" },
    { slug: "news", name: "News" },
  ],
  tags: [
    { tag: "home-loans", count: 3 },
    { tag: "chennai", count: 1 },
  ],
  category: "",
  nothingPublished: false,
};
const NO_PARAMS = { query: "", category: "", tag: "", page: 2 };

function list(data: BlogPageData = DATA, params = NO_PARAMS) {
  return renderWithMessages(<BlogListScreen data={data} params={params} />);
}

describe("BlogListScreen (ADR-143): the public Blog list", () => {
  it("has the one level-1 title, the breadcrumb, the search, the category chips and the tag row", () => {
    list();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: words.crumb.nav })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    const chips = screen.getByRole("navigation", { name: en.blog.filters.categories });
    expect(
      within(chips)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/blog", "/blog?category=guides", "/blog?category=news"]);
    const tags = screen.getByRole("navigation", { name: en.blog.filters.tags });
    expect(
      within(tags)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/blog?tag=home-loans", "/blog?tag=chennai"]);
  });

  it("draws a card for each article, linked to its own address, with the matched words marked as text", () => {
    list();
    const links = screen
      .getAllByRole("link", { name: /Title of/ })
      .map((link) => link.getAttribute("href"));
    expect(links).toEqual(["/blog/one", "/blog/two"]);
    const mark = document.querySelector("mark");
    expect(mark?.textContent).toBe("stamp");
    expect(document.querySelector("article script, article img[onerror]")).toBeNull();
  });

  it("never draws search words or snippet text as HTML", () => {
    list(
      {
        ...DATA,
        list: {
          ...DATA.list,
          items: [card("x", { snippet: "<img src=x onerror=alert(1)> [[<b>bold</b>]]" })],
        },
      },
      { ...NO_PARAMS, query: "<script>alert(1)</script>" },
    );
    expect(document.querySelector("article img")).toBeNull();
    expect(document.querySelector("article b")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("<script>alert(1)</script>");
  });

  it("keeps the choices in the links and in the search form", () => {
    list(
      { ...DATA, category: "guides" },
      { query: "loan", category: "guides", tag: "chennai", page: 2 },
    );
    const chips = screen.getByRole("navigation", { name: en.blog.filters.categories });
    expect(within(chips).getByRole("link", { name: "News" }).getAttribute("href")).toBe(
      "/blog?q=loan&category=news&tag=chennai",
    );
    expect(within(chips).getByRole("link", { name: "Guides" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const form = screen.getByRole("search");
    const hidden = Array.from(form.querySelectorAll("input[type=hidden]")).map(
      (input) => `${input.getAttribute("name")}=${input.getAttribute("value")}`,
    );
    expect(hidden).toEqual(["category=guides", "tag=chennai"]);
    expect(screen.getByRole("link", { name: words.clear })).toHaveAttribute("href", "/blog");
  });

  it("links the pages of the same list, back to page 1 without a page in the address", () => {
    list({ ...DATA, category: "guides" }, { query: "", category: "guides", tag: "", page: 2 });
    const pages = screen.getByRole("navigation", { name: en.blog.pagination.label });
    const hrefs = within(pages)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/blog?category=guides");
    expect(hrefs).toContain("/blog?category=guides&page=3");
  });

  it("says how many articles there are, or how many match", () => {
    list();
    expect(screen.getByText("30 articles")).toBeInTheDocument();
  });

  it("says so when nothing is published, with no search box and no chips", () => {
    list({
      ...DATA,
      list: { items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 },
      nothingPublished: true,
    });
    expect(screen.getByText(words.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("says no article matches, and offers the whole list, when a choice finds none", () => {
    list(
      { ...DATA, list: { items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 } },
      { query: "zzz", category: "", tag: "", page: 1 },
    );
    expect(screen.getByText(words.noMatches.title)).toBeInTheDocument();
    expect(screen.getByText("No articles match")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.noMatches.showAll })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});

const ARTICLE: BlogArticleView = {
  id: "id-article",
  slug: "stamp-duty",
  title: "Stamp duty explained",
  excerpt: "What you pay besides the price.",
  coverUrl: "https://files.test/blog/cover.jpg",
  coverAlt: "A house",
  tags: ["home-loans", "chennai"],
  authorName: "Asha Rao",
  publishedAt: "2026-11-10T08:00:00+00:00",
  readMinutes: 3,
  categoryId: "c1",
  category: { slug: "guides", name: "Guides" },
  seoTitle: null,
  seoDescription: null,
  updatedAt: "2026-11-12T08:00:00+00:00",
  body: [
    { type: "heading", level: 2, text: "Charges" },
    { type: "paragraph", text: "Pay <script>alert(1)</script> the duty." },
    { type: "list", ordered: true, items: ["First", "Second"] },
    { type: "quote", text: "Keep receipts.", cite: "A lawyer" },
    {
      type: "image",
      path: "blog/00000000-0000-4000-b500-0000000000a1/pic.png",
      alt: "A receipt",
      caption: "A receipt",
    },
  ],
};

function articleScreen(extra: Partial<Parameters<typeof BlogArticleScreen>[0]> = {}) {
  return renderWithMessages(
    <BlogArticleScreen
      article={ARTICLE}
      related={[card("next-one"), card("next-two")]}
      imageUrl={(path) => `https://files.test/${path}`}
      origin="https://findsprop.test"
      {...extra}
    />,
  );
}

describe("BlogArticleScreen (ADR-143, ADR-144): the public article", () => {
  it("has the title as the one level-1 heading, the breadcrumb to the Blog, the author, the date and the reading time", () => {
    articleScreen();
    expect(
      screen.getByRole("heading", { level: 1, name: "Stamp duty explained" }),
    ).toBeInTheDocument();
    const trail = screen.getByRole("navigation", { name: words.crumb.nav });
    expect(
      within(trail)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toContain("/blog");
    expect(screen.getAllByText("By Asha Rao").length).toBeGreaterThan(0);
    expect(screen.getByText("3 min read")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Guides" })).toHaveAttribute(
      "href",
      "/blog?category=guides",
    );
  });

  it("draws the blocks as plain text: what the admin typed never becomes markup", () => {
    articleScreen();
    expect(screen.getByRole("heading", { level: 2, name: "Charges" })).toBeInTheDocument();
    expect(screen.getByText("Pay <script>alert(1)</script> the duty.")).toBeInTheDocument();
    expect(document.querySelector("main script, p script")).toBeNull();
    expect(screen.getAllByRole("listitem").some((item) => item.textContent === "Second")).toBe(
      true,
    );
    expect(screen.getByText("Keep receipts.")).toBeInTheDocument();
  });

  it("links each tag to the list filtered by it, and has share links that open in a new tab", () => {
    articleScreen();
    const tags = screen.getByRole("navigation", { name: en.blog.article.tags });
    expect(
      within(tags)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/blog?tag=home-loans", "/blog?tag=chennai"]);
    const share = screen.getByRole("region", { name: en.blog.article.share.title });
    const whatsapp = within(share).getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp.getAttribute("href")).toContain(
      encodeURIComponent("https://findsprop.test/blog/stamp-duty"),
    );
  });

  it("writes the Article and BreadcrumbList documents with whole addresses", () => {
    articleScreen();
    const documents = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    ).map((script) => JSON.parse(script.textContent ?? "{}") as Record<string, unknown>);
    expect(documents.map((one) => one["@type"])).toEqual(["Article", "BreadcrumbList"]);
    expect(documents[0]?.["mainEntityOfPage"]).toEqual({
      "@type": "WebPage",
      "@id": "https://findsprop.test/blog/stamp-duty",
    });
    expect(JSON.stringify(documents[1])).toContain("https://findsprop.test/blog");
  });

  it("shows the read-next cards, and leaves the section out when there are none", () => {
    articleScreen();
    expect(
      screen.getByRole("heading", { level: 2, name: en.blog.related.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Title of next-one" })).toHaveAttribute(
      "href",
      "/blog/next-one",
    );
  });

  it("has no related section, no cover and no category when the article has none", () => {
    articleScreen({
      related: [],
      article: { ...ARTICLE, coverUrl: null, category: null, tags: [] },
    });
    expect(
      screen.queryByRole("heading", { level: 2, name: en.blog.related.title }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Guides" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: en.blog.article.tags }),
    ).not.toBeInTheDocument();
  });
});

describe("BlogShareLinks and the skeletons", () => {
  it("builds each share address from the article's address and title, encoded", () => {
    renderWithMessages(<BlogShareLinks url="https://findsprop.test/blog/a" title="Buy & sell" />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "https://wa.me/?text=Buy%20%26%20sell%20https%3A%2F%2Ffindsprop.test%2Fblog%2Fa",
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Ffindsprop.test%2Fblog%2Fa",
      "https://twitter.com/intent/tweet?url=https%3A%2F%2Ffindsprop.test%2Fblog%2Fa&text=Buy%20%26%20sell",
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Ffindsprop.test%2Fblog%2Fa",
      "mailto:?subject=Buy%20%26%20sell&body=https%3A%2F%2Ffindsprop.test%2Fblog%2Fa",
    ]);
  });

  it("draws both outlines, hidden from a screen reader", () => {
    const { container } = renderWithMessages(
      <>
        <BlogListSkeleton />
        <BlogArticleSkeleton />
      </>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });
});
