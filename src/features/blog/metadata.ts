import type { Metadata } from "next";
import { pageMetadata } from "@/features/seo";
import type { Translate } from "@/lib/format";
import { blogArticlePath, blogHref, type PublicBlogParams } from "./page-params";
import type { BlogArticleView } from "./view";

/**
 * The Blog list's title, description and canonical address (ADR-143, FR-PUB-14). A category, a tag or a later page is
 * its own page with its own address; a page found by free words is never indexed (its links are still followed), so a
 * search engine keeps the lists that mean something and not every word anyone typed.
 */
export function blogListMetadata(translate: Translate, params: PublicBlogParams): Metadata {
  const base = pageMetadata({
    title: translate("blog.page.metaTitle"),
    description: translate("blog.page.metaDescription"),
    path: blogHref({ category: params.category, tag: params.tag, page: params.page }),
    siteName: translate("meta.title"),
  });
  return params.query === "" ? base : { ...base, robots: { index: false, follow: true } };
}

/**
 * An article's title, description, canonical address and share card. The admin's search title and description win
 * when they wrote them; otherwise the title and the summary are used. The share picture is the cover when there is one.
 * The Open Graph type is "article", with its dates and tags.
 */
export function blogArticleMetadata(translate: Translate, article: BlogArticleView): Metadata {
  const path = blogArticlePath(article.slug);
  const base = pageMetadata({
    title: article.seoTitle?.trim() || article.title,
    description: article.seoDescription?.trim() || article.excerpt,
    path,
    siteName: translate("meta.title"),
    image: article.coverUrl,
    imageAlt: article.coverAlt ?? article.title,
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
      modifiedTime: article.updatedAt,
      authors: [article.authorName],
      ...(article.tags.length > 0 ? { tags: article.tags } : {}),
    },
  };
}
