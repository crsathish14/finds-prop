/**
 * BlogRelatedPosts: "Read next", up to three more articles under an article.
 * Purpose: keeps a reader in the Blog after the end of an article (ADR-143). Owner: design system. It holds no state and
 *   fetches nothing: the page passes the articles, already chosen (the same category first, then the newest).
 * Props: articles (the cards' facts, as BlogArticleCard takes them; at most three are drawn), allHref (the address of the
 *   whole Blog, for the link at the right of the title), className. With no articles nothing is drawn, not even the title.
 * Responsive: one column on a phone, two from 768 px and three from 1024 px, the same grid as the Blog list.
 * Accessibility: a labelled region whose title is a level-2 heading; each card is one link (see BlogArticleCard).
 * States: one, two and three articles; none (nothing drawn).
 * Dependencies: SectionHead, BlogArticleCard, Link, next-intl.
 * Tests: blog-parts.test.tsx; Design Lab "Blog article parts" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog article page, ADR-143 section 4).
 */
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { BlogArticleCard, type BlogArticleCardData } from "./blog-article-card";
import { SectionHead } from "./section-head";

type BlogRelatedPostsProps = {
  articles: readonly BlogArticleCardData[];
  allHref: string;
  className?: string;
};

function BlogRelatedPosts({ articles, allHref, className }: BlogRelatedPostsProps) {
  const translate = useTranslations();
  const headingId = useId();
  if (articles.length === 0) return null;
  return (
    <section
      data-slot="blog-related-posts"
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col", className)}
    >
      <SectionHead
        id={headingId}
        title={translate("blog.related.title")}
        action={
          <Link href={allHref} variant="arrow">
            {translate("blog.related.all")}
          </Link>
        }
      />
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.slice(0, 3).map((article) => (
          <li key={article.href} className="min-w-0">
            <BlogArticleCard article={article} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export { BlogRelatedPosts };
