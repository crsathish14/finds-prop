import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BlogArticleScreen,
  blogArticleMetadata,
  blogImageUrl,
  getBlogArticle,
  getRelatedPosts,
  parseBlogSlug,
} from "@/features/blog";
import { siteOrigin } from "@/features/seo";
import { getTranslate, requireContentModule } from "@/features/site";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const translate = await getTranslate();
  const parsed = parseBlogSlug(slug);
  const article = parsed === null ? null : await getBlogArticle(parsed);
  // A hidden module, a draft and a wrong address all read the same: a title and no index (the page itself answers 404).
  if (article === null) return { title: translate("notFound.title") };
  return blogArticleMetadata(translate, article);
}

/**
 * One published article (ADR-143, ADR-144). The address is the article's own slug. A switched-off module, an address that
 * is not a slug, and an article that is a draft, archived, in the Trash or does not exist all answer the normal
 * not-found page (the table's row policy hides the rest, so there is no separate check). The body is drawn from its
 * blocks as React text; the Article and Breadcrumb structured data, the canonical address and the share card are made
 * from the same article. The article is read through the cache under the `blog` tag and the article's own tag.
 */
export default async function BlogArticlePage({ params }: PageProps) {
  await requireContentModule("blog");
  const { slug } = await params;
  const parsed = parseBlogSlug(slug);
  if (parsed === null) notFound();
  const article = await getBlogArticle(parsed);
  if (article === null) notFound();
  const related = await getRelatedPosts(article);
  return (
    <main id="main" className="flex-1">
      <BlogArticleScreen
        article={article}
        related={related}
        imageUrl={blogImageUrl}
        origin={siteOrigin()}
      />
    </main>
  );
}
