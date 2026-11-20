/**
 * BlogArticleHeader: the top of an article page: category, title, summary, who wrote it, when and how long it takes
 *   to read, with the cover under it.
 * Purpose: the first screen of a Blog article (ADR-143). Owner: design system. It holds no state and fetches nothing.
 * Props: title, excerpt (the summary under the title; left out when empty), category { name, href } (the name links to
 *   the Blog filtered by it; left out when none), authorName, publishedAt (an ISO date), readMinutes, cover { src,
 *   alt } (left out when none: the header then has no picture), className. The title is the page's only level-1
 *   heading.
 * Responsive: one column about 68 characters wide, centred; the cover is the width of the page content up to 1024
 *   px, at a 16 : 9 shape, and loads first.
 * Accessibility: the title is the h1; the date is a time element; the meta line is a list of plain facts, never
 *   colour alone; the cover has the description the admin wrote.
 * States: with and without a category, a summary and a cover; a very long title wraps; cover missing or failed
 *   (illustrated tile).
 * Dependencies: Heading, Text, Link, Badge, CardCover, format helpers, next-intl.
 * Tests: blog-parts.test.tsx; Design Lab "Blog article parts" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog article page, ADR-143 section 4).
 */
import { useLocale, useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { CardCover } from "./property-card-controls.client";

type BlogArticleHeaderProps = {
  title: string;
  excerpt?: string | undefined;
  category?: { name: string; href: string } | null | undefined;
  authorName: string;
  publishedAt?: string | null | undefined;
  readMinutes?: number | undefined;
  cover?: { src: string; alt: string } | null | undefined;
  className?: string;
};

function BlogArticleHeader({
  title,
  excerpt,
  category,
  authorName,
  publishedAt,
  readMinutes,
  cover,
  className,
}: BlogArticleHeaderProps) {
  const translate = useTranslations();
  const locale = useLocale();
  return (
    <header
      data-slot="blog-article-header"
      className={cn("flex min-w-0 flex-col gap-6", className)}
    >
      <div className="mx-auto flex w-full max-w-prose min-w-0 flex-col gap-4">
        {category ? (
          <Link
            href={category.href}
            variant="default"
            className="w-fit text-overline text-cta-text no-underline"
          >
            {category.name}
          </Link>
        ) : null}
        <Heading as="h1" size="1" className="[overflow-wrap:anywhere]">
          {title}
        </Heading>
        {excerpt ? (
          <Text variant="lead" tone="muted" className="[overflow-wrap:anywhere]">
            {excerpt}
          </Text>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
          <span>{translate("blog.meta.by", { name: authorName })}</span>
          {publishedAt ? (
            <time dateTime={publishedAt}>{formatDate(locale, publishedAt, "long")}</time>
          ) : null}
          {readMinutes ? (
            <span>{translate("blog.meta.readMinutes", { minutes: readMinutes })}</span>
          ) : null}
        </p>
      </div>
      {cover ? (
        <div className="relative aspect-16/9 w-full overflow-hidden rounded-xl bg-canvas-sunken">
          <CardCover
            src={cover.src}
            alt={cover.alt}
            sizes="(min-width: 1100px) 1024px, 100vw"
            priority
          />
        </div>
      ) : null}
    </header>
  );
}

export { BlogArticleHeader };
