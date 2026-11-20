import { BlogArticleCard, BlogArticleCardSkeleton } from "@/components/domain/blog-article-card";
import type { BlogArticleCardData } from "@/components/domain/blog-article-card";
import { BlogArticleHeader } from "@/components/domain/blog-article-header";
import { BlogBlocks, type BlogBlock } from "@/components/domain/blog-blocks";
import { BlogCategoryChips, BlogSearchBox, BlogTagList } from "@/components/domain/blog-filters";
import { BlogRelatedPosts } from "@/components/domain/blog-related-posts";
import { PaginationBar } from "@/components/patterns/pagination-bar";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/** Made-up articles, so every picture is the same. The pictures are the Lab's drawn placeholders. */
const PICTURES = "/design-lab/listings";
const cover = (name: string) => ({
  src: `${PICTURES}/${name}.svg`,
  alt: "Drawn placeholder: a house with a pitched roof",
});

export const BLOG_IMAGE_URL = (path: string) => `${PICTURES}/${path}`;

const FULL: BlogArticleCardData = {
  href: "#guide",
  title: "A first-time buyer's guide to registration charges in Chennai",
  excerpt:
    "What you pay on top of the price of a flat, who collects it and when, with a worked example for a home of 60 lakh.",
  cover: cover("home-a"),
  category: "Buying guide",
  authorName: "Asha Rao",
  publishedAt: "2026-03-01T10:00:00+05:30",
  readMinutes: 6,
};

const NO_COVER: BlogArticleCardData = {
  href: "#renting",
  title: "Renting in Velachery: what to check in the lease",
  excerpt: "Notice periods, deposits and who pays for repairs.",
  category: "Renting",
  authorName: "Karthik Subramanian",
  publishedAt: "2026-02-12T10:00:00+05:30",
  readMinutes: 4,
};

const MINIMAL: BlogArticleCardData = {
  href: "#minimal",
  title: "Market note",
  authorName: "Asha Rao",
};

const LONG_WORDS: BlogArticleCardData = {
  href: "#long",
  title:
    "Pre-registration-documentation-checklist-for-a-multi-storey-apartment-purchase-in-Tamil-Nadu",
  excerpt:
    "Aextremelylongwordwithoutanyspacesinsideasummarytocheckthatthecardwrapsitandnevergrowswiderthanitscolumn and then some ordinary words.",
  cover: cover("home-b"),
  category: "Documents",
  authorName: "A writer with a rather long name indeed",
  publishedAt: "2026-01-20T10:00:00+05:30",
  readMinutes: 12,
};

const SEARCHED: BlogArticleCardData = {
  ...FULL,
  href: "#searched",
  snippet:
    "…what you pay on top of the price: the [[registration]] charges and the stamp duty, who collects them…",
};

export function BlogArticleCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        One article in the Blog list, the related list and the search results (ADR-143): the cover,
        the category, the title as the one link of the card, a short summary, the author, the date
        and the reading time. Missing facts are left out. A search shows a passage around the
        matched words, with the matches marked. All wording is draft wording for the owner to
        approve. Made-up articles.
      </Text>
      <div className="grid w-full gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Specimen label="With a cover, a category and every fact">
          <BlogArticleCard article={FULL} className="w-full" />
        </Specimen>
        <Specimen label="No cover: the drawn tile">
          <BlogArticleCard article={NO_COVER} className="w-full" />
        </Specimen>
        <Specimen label="A search result: the matched word is marked">
          <BlogArticleCard article={SEARCHED} className="w-full" />
        </Specimen>
        <Specimen label="Only a title and an author">
          <BlogArticleCard article={MINIMAL} className="w-full" />
        </Specimen>
        <Specimen label="A very long title, a word with no spaces and a long author name">
          <BlogArticleCard article={LONG_WORDS} className="w-full" />
        </Specimen>
        <Specimen label="Loading">
          <BlogArticleCardSkeleton className="w-full" />
        </Specimen>
      </div>
    </div>
  );
}

const BODY: BlogBlock[] = [
  {
    type: "paragraph",
    text: "Buying a flat is mostly paperwork. Most of the money goes to the seller; a smaller part goes to the state, and that part is easy to forget.",
  },
  { type: "heading", level: 2, text: "What you pay besides the price" },
  {
    type: "list",
    ordered: false,
    items: ["Stamp duty on the sale deed", "Registration charges", "A legal check of the title"],
  },
  {
    type: "image",
    path: "home-a.svg",
    alt: "Drawn placeholder: a house with a pitched roof",
    caption: "A drawn placeholder picture with its caption",
  },
  { type: "heading", level: 3, text: "In what order" },
  {
    type: "list",
    ordered: true,
    items: [
      "Check the title deed",
      "Sign the agreement to sell",
      "Pay the stamp duty",
      "Register the sale deed",
    ],
  },
  {
    type: "quote",
    text: "Never pay in cash without a receipt, however small the amount.",
    cite: "A Chennai property lawyer",
  },
  {
    type: "paragraph",
    text: "A line of text with <b>tags</b> and a script like <script>alert(1)</script> is shown exactly as typed, because every block is plain text.\nThe line break above is kept.",
  },
];

const RELATED: BlogArticleCardData[] = [
  FULL,
  { ...NO_COVER, cover: cover("home-c") },
  {
    ...MINIMAL,
    title: "Six questions to ask a builder before you pay a booking amount",
    category: "Buying guide",
    cover: cover("home-b"),
    readMinutes: 5,
    publishedAt: "2026-01-05T10:00:00+05:30",
  },
];

export function BlogArticlePartsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The parts of an article page (ADR-143): the header (category, the one level-1 title, the
        summary, the author, the date and the reading time, then the cover), the body drawn from its
        blocks and the Read next list. The body is always plain text: markup typed into a block is
        shown as typed. All wording is draft wording for the owner to approve. Made-up article.
      </Text>
      <Specimen label="Header with a category, a summary and a cover">
        <div className="w-full max-w-5xl">
          <BlogArticleHeader
            title="A first-time buyer's guide to registration charges in Chennai"
            excerpt="What you pay on top of the price of a flat, who collects it and when, with a worked example."
            category={{ name: "Buying guide", href: "#buying-guide" }}
            authorName="Asha Rao"
            publishedAt="2026-03-01T10:00:00+05:30"
            readMinutes={6}
            cover={cover("home-a")}
          />
        </div>
      </Specimen>
      <Specimen label="Header with only a title and an author: no category, summary, date or cover">
        <div className="w-full max-w-5xl">
          <BlogArticleHeader title="Market note" authorName="Asha Rao" />
        </div>
      </Specimen>
      <Specimen label="Body: paragraphs, both heading sizes, a bulleted and a numbered list, a quote with its credit and a picture with a caption">
        <div className="w-full max-w-5xl">
          <BlogBlocks blocks={BODY} imageUrl={BLOG_IMAGE_URL} />
        </div>
      </Specimen>
      <Specimen label="Read next with three articles">
        <div className="w-full max-w-5xl">
          <BlogRelatedPosts articles={RELATED} allHref="#blog" />
        </div>
      </Specimen>
      <Specimen label="Read next with one article">
        <div className="w-full max-w-5xl">
          <BlogRelatedPosts articles={RELATED.slice(0, 1)} allHref="#blog" />
        </div>
      </Specimen>
    </div>
  );
}

const CATEGORIES = [
  { slug: "buying", name: "Buying guide", href: "#buying" },
  { slug: "renting", name: "Renting", href: "#renting" },
  { slug: "investing", name: "Investment tips", href: "#investing" },
  { slug: "news", name: "Property news", href: "#news" },
  { slug: "market", name: "Market trends", href: "#market" },
];

const TAGS = [
  { tag: "home-loans", href: "#home-loans" },
  { tag: "chennai", href: "#chennai" },
  { tag: "registration", href: "#registration" },
  { tag: "first-time-buyer", href: "#first-time-buyer" },
  { tag: "rera", href: "#rera" },
];

export function BlogListControlsDemo() {
  const pageHref = (page: number) => `#page-${page}`;
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        What narrows the Blog list (ADR-143 section 4): the search box, the category chips, the tag
        chips and the page bar. Each one is a link or a form that puts its choice in the address
        (?q=&category=&tag=&page=), so a filtered list can be linked and the back button works. All
        wording is draft wording for the owner to approve.
      </Text>
      <Specimen label="Search box, empty">
        <div className="w-full max-w-3xl">
          <BlogSearchBox action="#blog" />
        </div>
      </Specimen>
      <Specimen label="Search box with words, keeping the chosen category">
        <div className="w-full max-w-3xl">
          <BlogSearchBox
            action="#blog"
            query="registration charges"
            hidden={[{ name: "category", value: "buying" }]}
          />
        </div>
      </Specimen>
      <Specimen label="Category chips: All is current">
        <BlogCategoryChips categories={CATEGORIES} allHref="#all" />
      </Specimen>
      <Specimen label="Category chips: one chosen (ticked and outlined, not colour alone)">
        <BlogCategoryChips categories={CATEGORIES} current="renting" allHref="#all" />
      </Specimen>
      <Specimen label="Tags, none chosen">
        <BlogTagList tags={TAGS} clearHref="#all" />
      </Specimen>
      <Specimen label="Tags, one chosen, with the way to clear it">
        <BlogTagList tags={TAGS} current="chennai" clearHref="#all" />
      </Specimen>
      <Specimen label="Page bar, first page of 9: no Previous">
        <PaginationBar page={1} pageCount={9} hrefFor={pageHref} className="w-full" />
      </Specimen>
      <Specimen label="Page bar, page 5 of 9: gaps either side of the neighbours">
        <PaginationBar page={5} pageCount={9} hrefFor={pageHref} className="w-full" />
      </Specimen>
      <Specimen label="Page bar, last page of 9: no Next">
        <PaginationBar page={9} pageCount={9} hrefFor={pageHref} className="w-full" />
      </Specimen>
      <Specimen label="Page bar, three pages: all numbers shown">
        <PaginationBar page={2} pageCount={3} hrefFor={pageHref} className="w-full" />
      </Specimen>
      <Specimen label="One page: nothing is drawn (the line below is the empty space)">
        <PaginationBar page={1} pageCount={1} hrefFor={pageHref} className="w-full" />
      </Specimen>
    </div>
  );
}
