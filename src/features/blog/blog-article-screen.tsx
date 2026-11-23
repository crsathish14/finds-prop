import { useTranslations } from "next-intl";
import { BlogArticleHeader } from "@/components/domain/blog-article-header";
import { BlogBlocks } from "@/components/domain/blog-blocks";
import { BlogTagList } from "@/components/domain/blog-filters";
import { BlogRelatedPosts } from "@/components/domain/blog-related-posts";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { JsonLd } from "@/features/seo";
import { BlogShareLinks } from "./blog-share-links";
import { cardDataOf } from "./blog-list-screen";
import { articleBreadcrumbs, articleDocument } from "./json-ld";
import { blogArticlePath, blogHref, BLOG_PATH } from "./page-params";
import type { BlogArticleView, BlogCardView } from "./view";

type BlogArticleScreenProps = {
  article: BlogArticleView;
  /** Up to three more articles to read next (already chosen: the same category first, then the newest). */
  related: BlogCardView[];
  /** The address of a stored picture, made by the page from the project's storage address. */
  imageUrl: (path: string) => string;
  /** The site's origin, for the whole addresses in the structured data and the share links. */
  origin: string;
};

/**
 * The public article page below the header (ADR-143 section 4, ADR-144): breadcrumb, the top (category, title, summary,
 * author, date, reading time, cover), the body drawn from its blocks, the tags, the share links and the "read next"
 * cards. Everything the admin typed is drawn as React text (R-SEC-10). The structured data is an Article and the
 * breadcrumb trail. The page hands it what to show, so it reads nothing itself.
 */
export function BlogArticleScreen({ article, related, imageUrl, origin }: BlogArticleScreenProps) {
  const translate = useTranslations("blog.article");
  const crumbs = useTranslations("blog.page.crumb");
  const meta = useTranslations("meta");
  const url = `${origin}${blogArticlePath(article.slug)}`;

  return (
    <Container className="py-6 md:py-8">
      <JsonLd data={articleDocument(article, { url, siteName: meta("title") })} />
      <JsonLd
        data={articleBreadcrumbs({
          homeName: crumbs("home"),
          homeUrl: `${origin}/`,
          blogName: crumbs("blog"),
          blogUrl: `${origin}${BLOG_PATH}`,
          title: article.title,
          url,
        })}
      />
      <Breadcrumb
        navLabel={crumbs("nav")}
        backLabel={crumbs("backBlog")}
        items={[
          { label: crumbs("home"), href: "/" },
          { label: crumbs("blog"), href: BLOG_PATH },
          { label: article.title },
        ]}
        className="mb-6"
      />
      <article className="flex flex-col gap-8">
        <BlogArticleHeader
          title={article.title}
          excerpt={article.excerpt}
          category={
            article.category
              ? { name: article.category.name, href: blogHref({ category: article.category.slug }) }
              : null
          }
          authorName={article.authorName}
          publishedAt={article.publishedAt}
          readMinutes={article.readMinutes}
          cover={
            article.coverUrl
              ? { src: article.coverUrl, alt: article.coverAlt ?? article.title }
              : null
          }
        />
        <BlogBlocks blocks={article.body} imageUrl={imageUrl} />
        <div className="mx-auto flex w-full max-w-prose min-w-0 flex-col gap-6">
          <BlogTagList
            tags={article.tags.map((tag) => ({ tag, href: blogHref({ tag }) }))}
            clearHref={BLOG_PATH}
            heading={translate("tags")}
          />
          <BlogShareLinks url={url} title={article.title} />
        </div>
      </article>
      <BlogRelatedPosts
        articles={related.map(cardDataOf)}
        allHref={BLOG_PATH}
        className="mt-10 border-t border-line pt-8"
      />
    </Container>
  );
}
