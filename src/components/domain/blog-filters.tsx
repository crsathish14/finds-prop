/**
 * BlogSearchBox, BlogCategoryChips and BlogTagList: how a visitor narrows the Blog list.
 * Purpose: the three controls above the Blog list (ADR-143 section 4): a search box, the categories as chips and the tags
 *   as quieter chips. Each narrows the list through the address (`?q=&category=&tag=&page=`), so a filtered list can be
 *   linked and the back button works; nothing here keeps state. Owner: design system.
 * Props: BlogSearchBox: action (the list's address), query (the words now), hidden (the other filters to keep when
 *   searching, as { name, value } pairs), className. BlogCategoryChips: categories ({ slug, name, href }), current (the
 *   slug now, or null for All), allHref (the address of the list with no category), className. BlogTagList: tags
 *   ({ tag, href, count? }), current (the tag now, or null), clearHref (the address with no tag), heading (a label
 *   when the list stands alone, as under an article), className.
 * Responsive: the search box and its button share one line; chips wrap onto as many lines as they need and never widen
 *   the page.
 * Accessibility: the box is a search landmark with a real label (hidden from sight, read by a screen reader); a chip is
 *   a link, the current one is marked with aria-current and a tick as well as colour; each list is named.
 * States: default, with words typed, a category or a tag chosen, many categories, no categories (the row is left out),
 *   long names.
 * Dependencies: Input, Button, Chip, Icon, Label, Link, VisuallyHidden, next-intl.
 * Tests: blog-parts.test.tsx; Design Lab "Blog list controls" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog list, ADR-143 section 4).
 */
import { Check, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type BlogSearchBoxProps = {
  action: string;
  query?: string | undefined;
  hidden?: readonly { name: string; value: string }[];
  className?: string;
};

function BlogSearchBox({ action, query = "", hidden = [], className }: BlogSearchBoxProps) {
  const translate = useTranslations();
  const inputId = useId();
  return (
    <form
      data-slot="blog-search-box"
      role="search"
      action={action}
      method="get"
      className={cn("flex w-full min-w-0 items-start gap-3", className)}
    >
      {hidden.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <div className="min-w-0 flex-1">
        <VisuallyHidden>
          <Label htmlFor={inputId}>{translate("blog.search.label")}</Label>
        </VisuallyHidden>
        <Input
          id={inputId}
          name="q"
          type="search"
          defaultValue={query}
          maxLength={200}
          placeholder={translate("blog.search.placeholder")}
          autoComplete="off"
          leading={<Icon icon={Search} />}
        />
      </div>
      <Button type="submit" variant="primary" size="md">
        {translate("blog.search.submit")}
      </Button>
    </form>
  );
}

/** The look of a chip that is a link and marks the current one with aria-current. */
const CURRENT_CHIP =
  "aria-[current=true]:border-primary aria-[current=true]:bg-primary-tint aria-[current=true]:text-primary";

type BlogCategoryChipsProps = {
  categories: readonly { slug: string; name: string; href: string }[];
  current?: string | null | undefined;
  allHref: string;
  className?: string;
};

function BlogCategoryChips({
  categories,
  current = null,
  allHref,
  className,
}: BlogCategoryChipsProps) {
  const translate = useTranslations();
  if (categories.length === 0) return null;
  return (
    <nav
      data-slot="blog-category-chips"
      aria-label={translate("blog.filters.categories")}
      className={className}
    >
      <ul className="flex flex-wrap gap-2">
        <li>
          <Chip asChild className={CURRENT_CHIP}>
            <Link href={allHref} aria-current={current === null ? "true" : undefined}>
              {current === null ? <Icon icon={Check} size="sm" /> : null}
              {translate("blog.filters.all")}
            </Link>
          </Chip>
        </li>
        {categories.map((category) => (
          <li key={category.slug}>
            <Chip asChild className={CURRENT_CHIP}>
              <Link
                href={category.href}
                aria-current={current === category.slug ? "true" : undefined}
              >
                {current === category.slug ? <Icon icon={Check} size="sm" /> : null}
                {category.name}
              </Link>
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type BlogTagListProps = {
  tags: readonly { tag: string; href: string; count?: number | undefined }[];
  current?: string | null | undefined;
  clearHref: string;
  heading?: string | undefined;
  className?: string;
};

function BlogTagList({ tags, current = null, clearHref, heading, className }: BlogTagListProps) {
  const translate = useTranslations();
  const labelId = useId();
  if (tags.length === 0) return null;
  return (
    <nav
      data-slot="blog-tag-list"
      aria-labelledby={labelId}
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      <p id={labelId} className={heading ? "text-overline text-muted" : "sr-only"}>
        {heading ?? translate("blog.filters.tags")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {tags.map((entry) => (
          <li key={entry.tag}>
            <Chip asChild size="sm" soft className={CURRENT_CHIP}>
              <Link href={entry.href} aria-current={current === entry.tag ? "true" : undefined}>
                {current === entry.tag ? <Icon icon={Check} size="sm" /> : null}
                {translate("blog.filters.tag", { tag: entry.tag })}
              </Link>
            </Chip>
          </li>
        ))}
        {current ? (
          <li>
            <Chip asChild size="sm" className="border-dashed">
              <Link href={clearHref}>
                <Icon icon={X} size="sm" />
                {translate("blog.filters.clearTag")}
              </Link>
            </Chip>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export { BlogCategoryChips, BlogSearchBox, BlogTagList };
