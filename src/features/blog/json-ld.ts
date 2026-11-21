import { breadcrumbList, compact, JSON_LD_CONTEXT, type JsonLdDocument } from "@/features/seo";
import type { BlogArticleView } from "./view";

/**
 * The article page's structured data for search engines (ADR-143, FR-PUB-14): an Article with its headline, picture,
 * dates, author, publisher and keywords, and the BreadcrumbList of Home, Blog and the article. Every value is plain
 * text from the admin; the page writes the documents with `JsonLd`, which escapes them for a script block.
 */
export function articleDocument(
  article: BlogArticleView,
  input: { url: string; siteName: string },
): JsonLdDocument {
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "Article",
    ...compact({
      headline: article.title,
      description: article.seoDescription?.trim() || article.excerpt,
      image: article.coverUrl ? [article.coverUrl] : [],
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      keywords: article.tags.join(", "),
      articleSection: article.category?.name ?? null,
    }),
    author: { "@type": "Person", name: article.authorName },
    publisher: { "@type": "Organization", name: input.siteName },
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
  };
}

export function articleBreadcrumbs(input: {
  homeName: string;
  homeUrl: string;
  blogName: string;
  blogUrl: string;
  title: string;
  url: string;
}): JsonLdDocument {
  return breadcrumbList([
    { name: input.homeName, url: input.homeUrl },
    { name: input.blogName, url: input.blogUrl },
    { name: input.title, url: input.url },
  ]);
}
