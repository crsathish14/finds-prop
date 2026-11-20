// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/i18n/messages/en.json";
import { PaginationBar, visiblePages } from "@/components/patterns/pagination-bar";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogArticleCard, BlogArticleCardSkeleton } from "../blog-article-card";
import { BlogArticleHeader } from "../blog-article-header";
import { BlogBlocks, type BlogBlock } from "../blog-blocks";
import { BlogCategoryChips, BlogSearchBox, BlogTagList } from "../blog-filters";
import { BlogRelatedPosts } from "../blog-related-posts";

/** What the app layout provides, for `rerender` (which renders without the provider that `renderWithMessages` adds). */
function inApp(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  );
}

const imageUrl = (path: string) => `/pictures/${path}.svg`;

const BLOCKS: BlogBlock[] = [
  { type: "heading", level: 2, text: "Section" },
  { type: "heading", level: 3, text: "Sub-section" },
  { type: "paragraph", text: "First line.\nSecond line." },
  { type: "list", ordered: false, items: ["One", "Two"] },
  { type: "list", ordered: true, items: ["First", "Second"] },
  { type: "quote", text: "Quoted words.", cite: "Someone" },
  { type: "image", path: "home-a", alt: "A bright flat", caption: "The flat" },
];

describe("BlogBlocks: the body of an article (ADR-144)", () => {
  it("draws each kind of block as its own element, with the heading levels the page's outline needs", () => {
    renderWithMessages(<BlogBlocks blocks={BLOCKS} imageUrl={imageUrl} />);
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Sub-section" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    const lists = screen.getAllByRole("list");
    expect(lists.map((list) => list.tagName)).toEqual(["UL", "OL"]);
    expect(within(lists[1] as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Quoted words.").closest("blockquote")).not.toBeNull();
    expect(screen.getByText("Someone").tagName).toBe("CITE");
    expect(screen.getByText("The flat").tagName).toBe("FIGCAPTION");
  });

  it("gives a picture the description as its alt text", () => {
    renderWithMessages(<BlogBlocks blocks={BLOCKS} imageUrl={imageUrl} />);
    expect(screen.getByAltText("A bright flat")).toBeInTheDocument();
  });

  it("shows markup typed into a block as plain text and never as elements", () => {
    const { container } = renderWithMessages(
      <BlogBlocks
        imageUrl={imageUrl}
        blocks={[
          { type: "paragraph", text: "<b>bold</b> <script>alert(1)</script>" },
          { type: "list", ordered: false, items: ["<img src=x onerror=alert(1)>"] },
          { type: "quote", text: "<a href='https://example.test'>link</a>" },
        ]}
      />,
    );
    expect(container.querySelector("script, b, a, img")).toBeNull();
    expect(screen.getByText("<b>bold</b> <script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });

  it("leaves out a block of a kind it does not know, and draws nothing for an empty body", () => {
    const { container } = renderWithMessages(
      <BlogBlocks
        imageUrl={imageUrl}
        blocks={[{ type: "html", text: "<b>x</b>" } as unknown as BlogBlock]}
      />,
    );
    expect(container.querySelector("[data-slot='blog-blocks']")?.children).toHaveLength(0);
  });
});

const CARD = {
  href: "/blog/guide",
  title: "A guide",
  excerpt: "A short summary.",
  cover: { src: "/pictures/home-a.svg", alt: "A bright flat" },
  category: "Buying guide",
  authorName: "Asha Rao",
  publishedAt: "2026-03-01T10:00:00+05:30",
  readMinutes: 6,
};

describe("BlogArticleCard", () => {
  it("makes the title the card's one link and shows the facts", () => {
    renderWithMessages(<BlogArticleCard article={CARD} />);
    expect(screen.getByRole("link", { name: "A guide" })).toHaveAttribute("href", "/blog/guide");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Buying guide")).toBeInTheDocument();
    expect(screen.getByText("By Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("6 min read")).toBeInTheDocument();
    expect(screen.getByText("1 Mar 2026").tagName).toBe("TIME");
  });

  it("marks searched words in a snippet with a mark element and keeps the rest as text", () => {
    const { container } = renderWithMessages(
      <BlogArticleCard
        article={{ ...CARD, snippet: "what you pay: the [[registration]] charges <b>x</b>" }}
      />,
    );
    expect(container.querySelector("mark")?.textContent).toBe("registration");
    expect(container.querySelector("b")).toBeNull();
    expect(screen.queryByText("A short summary.")).not.toBeInTheDocument();
  });

  it("leaves out facts it was not given, and draws the tile when there is no cover", () => {
    const { container } = renderWithMessages(
      <BlogArticleCard article={{ href: "/blog/x", title: "Only a title" }} />,
    );
    expect(container.querySelector("time")).toBeNull();
    expect(container.querySelector("[data-slot='card-cover-fallback']")).not.toBeNull();
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
  });

  it("has a loading shape that is hidden from screen readers", () => {
    const { container } = renderWithMessages(<BlogArticleCardSkeleton />);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("BlogArticleHeader", () => {
  it("has the page's only level-1 heading, a category link and the meta line", () => {
    renderWithMessages(
      <BlogArticleHeader
        title="A guide"
        excerpt="A summary."
        category={{ name: "Buying guide", href: "/blog?category=buying" }}
        authorName="Asha Rao"
        publishedAt="2026-03-01T10:00:00+05:30"
        readMinutes={6}
        cover={{ src: "/pictures/home-a.svg", alt: "A bright flat" }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "A guide" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buying guide" })).toHaveAttribute(
      "href",
      "/blog?category=buying",
    );
    expect(screen.getByText("By Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("1 March 2026").tagName).toBe("TIME");
    expect(screen.getByAltText("A bright flat")).toBeInTheDocument();
  });

  it("is only a title and an author when nothing else is given", () => {
    const { container } = renderWithMessages(
      <BlogArticleHeader title="Market note" authorName="Asha Rao" />,
    );
    expect(container.querySelector("time, img, a")).toBeNull();
  });
});

describe("BlogRelatedPosts", () => {
  it("draws up to three cards under a Read next heading, and nothing with none", () => {
    const four = [1, 2, 3, 4].map((number) => ({
      ...CARD,
      href: `/blog/${number}`,
      title: `Article ${number}`,
    }));
    const { container, rerender } = renderWithMessages(
      <BlogRelatedPosts articles={four} allHref="/blog" />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Read next" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    rerender(inApp(<BlogRelatedPosts articles={[]} allHref="/blog" />));
    expect(container.querySelector("[data-slot='blog-related-posts']")).toBeNull();
  });
});

describe("BlogSearchBox, BlogCategoryChips and BlogTagList", () => {
  it("is a search landmark with a labelled box that keeps the other filters and the words typed", () => {
    renderWithMessages(
      <BlogSearchBox
        action="/blog"
        query="stamp duty"
        hidden={[{ name: "category", value: "buying" }]}
      />,
    );
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/blog");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByLabelText("Search articles")).toHaveValue("stamp duty");
    expect(form.querySelector("input[type='hidden'][name='category']")).toHaveAttribute(
      "value",
      "buying",
    );
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("marks the current category with aria-current and a tick, and All when none is chosen", () => {
    const categories = [
      { slug: "buying", name: "Buying guide", href: "/blog?category=buying" },
      { slug: "renting", name: "Renting", href: "/blog?category=renting" },
    ];
    const { rerender } = renderWithMessages(
      <BlogCategoryChips categories={categories} allHref="/blog" />,
    );
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Renting" })).not.toHaveAttribute("aria-current");
    rerender(
      inApp(<BlogCategoryChips categories={categories} current="renting" allHref="/blog" />),
    );
    expect(screen.getByRole("link", { name: "Renting" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("draws nothing for no categories and no tags, and offers to clear a chosen tag", () => {
    const { container, rerender } = renderWithMessages(
      <BlogCategoryChips categories={[]} allHref="/blog" />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(inApp(<BlogTagList tags={[]} clearHref="/blog" />));
    expect(container.querySelector("nav")).toBeNull();
    rerender(
      inApp(
        <BlogTagList
          tags={[{ tag: "chennai", href: "/blog?tag=chennai" }]}
          current="chennai"
          clearHref="/blog"
        />,
      ),
    );
    expect(screen.getByRole("link", { name: "#chennai" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Clear tag" })).toHaveAttribute("href", "/blog");
  });
});

describe("PaginationBar", () => {
  const hrefFor = (page: number) => (page === 1 ? "/blog" : `/blog?page=${page}`);

  it("shows at most seven entries with gaps, and always the first, the current and the last page", () => {
    expect(visiblePages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePages(1, 9)).toEqual([1, 2, 3, 4, null, 9]);
    expect(visiblePages(5, 9)).toEqual([1, null, 4, 5, 6, null, 9]);
    expect(visiblePages(9, 9)).toEqual([1, null, 6, 7, 8, 9]);
    for (let page = 1; page <= 30; page += 1) {
      const shown = visiblePages(page, 30);
      expect(shown.length).toBeLessThanOrEqual(7);
      expect(shown).toContain(page);
      expect(shown[0]).toBe(1);
      expect(shown.at(-1)).toBe(30);
    }
  });

  it("links to the neighbours, marks the current page and says where each link goes", () => {
    renderWithMessages(<PaginationBar page={2} pageCount={4} hrefFor={hrefFor} />);
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getByRole("link", { name: /Previous/ })).toHaveAttribute("href", "/blog");
    expect(within(nav).getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/blog?page=3");
    expect(within(nav).getByText("2").closest("[aria-current='page']")).not.toBeNull();
    expect(within(nav).getByRole("link", { name: /^4/ })).toHaveAttribute("href", "/blog?page=4");
  });

  it("has no Previous on the first page and no Next on the last", () => {
    const { rerender } = renderWithMessages(
      <PaginationBar page={1} pageCount={3} hrefFor={hrefFor} />,
    );
    expect(screen.queryByRole("link", { name: /Previous/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next/ })).toBeInTheDocument();
    rerender(inApp(<PaginationBar page={3} pageCount={3} hrefFor={hrefFor} />));
    expect(screen.queryByRole("link", { name: /Next/ })).not.toBeInTheDocument();
  });

  it("draws nothing for one page", () => {
    const { container } = renderWithMessages(
      <PaginationBar page={1} pageCount={1} hrefFor={hrefFor} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
