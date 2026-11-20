/**
 * BlogArticleCard: one article in the Blog list, in the related list and in search results.
 * Purpose: the card of the public Blog (ADR-143): cover, category, title, a short summary, who wrote it, when and how
 *   long it takes to read. Owner: design system. It holds no state and fetches nothing: the page passes the article's
 *   facts, already read from the database.
 * Props: article (href, title, excerpt, snippet (a passage around the searched words, the matches between [[ and ]],
 *   shown instead of the excerpt; left out when missing), cover { src, alt }, category (the name), authorName,
 *   publishedAt (an ISO date), readMinutes), sizes (next/image `sizes` for this card's column), priority (first
 *   cards on the page), className. Missing facts are left out, never shown blank.
 * Responsive: a column of picture over text at every width; the grid around it sets the columns.
 * Accessibility: the whole card is one link target: the title link is stretched over the card. A keyboard ring is drawn
 *   around the card when that link has focus. The picture has the cover's description. Searched words in a snippet are
 *   drawn in a mark element, never as HTML. The date is a time element.
 * States: default, hover (shadow and a stronger border), focus, picture missing or failed (illustrated tile), loading
 *   (BlogArticleCardSkeleton).
 * Dependencies: Badge, Link, Skeleton, CardCover, format helpers, next-intl.
 * Tests: blog-parts.test.tsx; Design Lab "Blog article card" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog list, ADR-143 section 4).
 */
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { CardCover } from "./property-card-controls.client";

type BlogArticleCardData = {
  href: string;
  title: string;
  excerpt?: string | undefined;
  snippet?: string | null | undefined;
  cover?: { src: string; alt: string } | null | undefined;
  category?: string | null | undefined;
  authorName?: string | undefined;
  publishedAt?: string | null | undefined;
  readMinutes?: number | undefined;
};

type BlogArticleCardProps = {
  article: BlogArticleCardData;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

const DEFAULT_SIZES = "(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw";

/** A search snippet cut into plain text and matched words (the matches are between [[ and ]]). */
function snippetPieces(snippet: string): { text: string; matched: boolean }[] {
  const pieces: { text: string; matched: boolean }[] = [];
  let last = 0;
  for (const match of snippet.matchAll(/\[\[(.*?)\]\]/g)) {
    if (match.index > last) pieces.push({ text: snippet.slice(last, match.index), matched: false });
    pieces.push({ text: match[1] ?? "", matched: true });
    last = match.index + match[0].length;
  }
  if (last < snippet.length) pieces.push({ text: snippet.slice(last), matched: false });
  return pieces;
}

function BlogArticleCard({
  article,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
}: BlogArticleCardProps) {
  const translate = useTranslations();
  const locale = useLocale();
  const summary = article.snippet ?? article.excerpt;

  return (
    <article
      data-slot="blog-article-card"
      className={cn(
        "group/card relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
        "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
        "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
        className,
      )}
    >
      <div className="relative aspect-16/10 shrink-0 overflow-hidden bg-canvas-sunken">
        <CardCover
          src={article.cover?.src}
          alt={article.cover?.alt}
          sizes={sizes}
          priority={priority}
        />
        {article.category ? (
          <div className="pointer-events-none absolute top-3 left-3 z-10">
            <Badge tone="outline">{article.category}</Badge>
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-h3 text-primary [overflow-wrap:anywhere]" data-slot="blog-card-title">
          <Link
            href={article.href}
            data-stretched=""
            className="rounded-xs font-(weight:--display-weight) text-primary no-underline outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
          >
            {article.title}
          </Link>
        </h3>
        {summary ? (
          <p className="line-clamp-3 text-small text-muted [overflow-wrap:anywhere]">
            {article.snippet
              ? snippetPieces(article.snippet).map((piece, index) =>
                  piece.matched ? (
                    <mark key={index} className="rounded-xs bg-cta-tint px-1 text-ink">
                      {piece.text}
                    </mark>
                  ) : (
                    <span key={index}>{piece.text}</span>
                  ),
                )
              : summary}
          </p>
        ) : null}
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-caption text-muted">
          {article.authorName ? (
            <span>{translate("blog.meta.by", { name: article.authorName })}</span>
          ) : null}
          {article.publishedAt ? (
            <time dateTime={article.publishedAt}>{formatDate(locale, article.publishedAt)}</time>
          ) : null}
          {article.readMinutes ? (
            <span>{translate("blog.meta.readMinutes", { minutes: article.readMinutes })}</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

/** The loading shape of a card: same picture, three lines and the meta line. */
function BlogArticleCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="blog-article-card-skeleton"
      aria-hidden="true"
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
        className,
      )}
    >
      <Skeleton className="aspect-16/10 w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-2 h-3 w-2/5" />
      </div>
    </div>
  );
}

export { BlogArticleCard, BlogArticleCardSkeleton };
export type { BlogArticleCardData };
