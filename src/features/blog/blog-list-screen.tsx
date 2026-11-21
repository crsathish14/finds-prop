import { useTranslations } from "next-intl";
import { BlogArticleCard, type BlogArticleCardData } from "@/components/domain/blog-article-card";
import { BlogCategoryChips, BlogSearchBox, BlogTagList } from "@/components/domain/blog-filters";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { EmptyState } from "@/components/patterns/empty-state";
import { PaginationBar } from "@/components/patterns/pagination-bar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { blogArticlePath, blogHref, BLOG_PATH, type PublicBlogParams } from "./page-params";
import type { BlogPageData } from "./queries";
import type { BlogCardView } from "./view";

/** The facts a card draws, from an article of the list. */
export function cardDataOf(article: BlogCardView): BlogArticleCardData {
  return {
    href: blogArticlePath(article.slug),
    title: article.title,
    excerpt: article.excerpt,
    snippet: article.snippet,
    cover: article.coverUrl
      ? { src: article.coverUrl, alt: article.coverAlt ?? article.title }
      : null,
    category: article.category?.name ?? null,
    authorName: article.authorName,
    publishedAt: article.publishedAt,
    readMinutes: article.readMinutes,
  };
}

type BlogListScreenProps = {
  data: BlogPageData;
  /** What the address asked for (the category here is the one that really exists, see `data.category`). */
  params: PublicBlogParams;
};

/**
 * The public Blog list below the header (ADR-143 section 4): the breadcrumb, the title, the search box, the category
 * chips and the tag row, the page of article cards, and the page links. Every choice is in the address
 * (`?q=&category=&tag=&page=`), so a filtered list can be linked, works without scripts and the back button restores it.
 * Search words are drawn as text with the matches marked (BlogArticleCard), never as HTML. Every state is drawn:
 * articles, nothing published yet, and no match. The page hands it what to show, so it reads nothing itself.
 */
export function BlogListScreen({ data, params }: BlogListScreenProps) {
  const translate = useTranslations("blog.page");
  const { list, categories, tags, category, nothingPublished } = data;
  const choice = { query: params.query, category, tag: params.tag };
  const filtering = params.query !== "" || category !== "" || params.tag !== "";
  const summary = translate(filtering ? "summary.filtered" : "summary.all", { count: list.total });

  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("crumb.nav")}
        backLabel={translate("crumb.backHome")}
        items={[{ label: translate("crumb.home"), href: "/" }, { label: translate("crumb.blog") }]}
      />
      <div className="mt-6 mb-6 flex max-w-3xl flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("lead")}</Text>
      </div>
      {nothingPublished ? (
        <EmptyState title={translate("empty.title")} description={translate("empty.text")} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex max-w-3xl flex-col gap-4">
            <BlogSearchBox
              action={BLOG_PATH}
              query={params.query}
              hidden={[
                ...(category ? [{ name: "category", value: category }] : []),
                ...(params.tag ? [{ name: "tag", value: params.tag }] : []),
              ]}
            />
            <BlogCategoryChips
              categories={categories.map((item) => ({
                slug: item.slug,
                name: item.name,
                href: blogHref({ ...choice, category: item.slug }),
              }))}
              current={category === "" ? null : category}
              allHref={blogHref({ ...choice, category: "" })}
            />
            <BlogTagList
              tags={tags.map((entry) => ({
                tag: entry.tag,
                count: entry.count,
                href: blogHref({ ...choice, tag: entry.tag }),
              }))}
              current={params.tag === "" ? null : params.tag}
              clearHref={blogHref({ ...choice, tag: "" })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-small text-muted" aria-live="polite">
              {summary}
            </p>
            {filtering ? (
              <Link href={BLOG_PATH} variant="nav" className="text-small">
                {translate("clear")}
              </Link>
            ) : null}
          </div>
          {list.items.length === 0 ? (
            <EmptyState
              title={translate("noMatches.title")}
              description={translate("noMatches.text")}
            >
              <Button asChild variant="primary">
                <Link href={BLOG_PATH} variant="nav" className="no-underline">
                  {translate("noMatches.showAll")}
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {list.items.map((article, index) => (
                <li key={article.id} className="min-w-0">
                  <BlogArticleCard article={cardDataOf(article)} priority={index === 0} />
                </li>
              ))}
            </ul>
          )}
          <PaginationBar
            page={list.page}
            pageCount={list.pageCount}
            hrefFor={(page) => blogHref({ ...choice, page })}
          />
        </div>
      )}
    </Container>
  );
}
