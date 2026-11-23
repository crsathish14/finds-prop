/**
 * PaginationBar: Previous, numbered pages and Next, as links.
 * Purpose: moving through a long list that is split into pages and kept in the address (the Blog list, ADR-143).
 *   Owner: design system. It holds no state and fetches nothing: the page passes the current page, how many there are
 *   and where each page lives, so every page is a real address that can be linked and that the back button restores.
 * Props: page (the current page, from 1), pageCount, hrefFor (the address of a page number; page 1 should be the list
 *   with no page in it), className. Fewer than two pages draw nothing. More than seven pages show the first, the last,
 *   the current one and its neighbours, with a gap mark between the runs.
 * Responsive: on a phone only Previous, "Page 3 of 9" and Next show (the numbers would not fit at a 44 px target); from
 *   640 px the numbered pages show as well.
 * Accessibility: a nav landmark named "Pages"; the current page is aria-current="page" and says so in words to a screen
 *   reader; Previous and Next are links named with the page they go to, and are plain disabled text at either end; the
 *   gap mark is hidden from screen readers.
 * States: first page (no Previous), last page (no Next), a middle page, few pages (all shown), many pages (gaps), one
 *   page (nothing drawn).
 * Dependencies: Link, Icon, VisuallyHidden, cn, next-intl.
 * Tests: blog-parts.test.tsx; Design Lab "Blog list controls" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog list, ADR-143 section 4).
 */
import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type PaginationBarProps = {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  className?: string;
};

/** The page numbers to show, with `null` for a gap: at most seven entries however many pages there are. */
function visiblePages(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) for (const number of [2, 3, 4]) wanted.add(number);
  if (page >= pageCount - 2)
    for (const number of [pageCount - 3, pageCount - 2, pageCount - 1]) wanted.add(number);
  const sorted = [...wanted]
    .filter((number) => number >= 1 && number <= pageCount)
    .sort((first, second) => first - second);
  const shown: (number | null)[] = [];
  sorted.forEach((number, index) => {
    const before = sorted[index - 1];
    if (before !== undefined && number - before > 1) shown.push(null);
    shown.push(number);
  });
  return shown;
}

const STEP =
  "inline-flex min-h-(--size-control) min-w-(--size-control) items-center justify-center gap-1 rounded-md border-[length:var(--bw-field)] px-3 text-small font-semibold";

function PaginationBar({ page, pageCount, hrefFor, className }: PaginationBarProps) {
  const translate = useTranslations();
  if (pageCount < 2) return null;
  const current = Math.min(Math.max(1, page), pageCount);
  return (
    <nav
      data-slot="pagination-bar"
      aria-label={translate("blog.pagination.label")}
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      {current > 1 ? (
        <Link
          href={hrefFor(current - 1)}
          className={cn(
            STEP,
            "border-line-strong bg-surface text-ink no-underline hover:border-primary",
          )}
        >
          <Icon icon={ChevronLeft} />
          <span>{translate("blog.pagination.previous")}</span>{" "}
          <VisuallyHidden>
            {translate("blog.pagination.goTo", { page: current - 1 })}
          </VisuallyHidden>
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(STEP, "border-line text-subtle")}>
          <Icon icon={ChevronLeft} />
          <span>{translate("blog.pagination.previous")}</span>
        </span>
      )}
      <p className="px-2 text-small text-muted md:hidden">
        {translate("blog.pagination.position", { page: current, count: pageCount })}
      </p>
      <ol className="hidden items-center gap-2 md:flex">
        {visiblePages(current, pageCount).map((number, index) =>
          number === null ? (
            <li key={-(index + 1)} aria-hidden="true" className="px-1 text-muted">
              <Icon icon={Ellipsis} />
            </li>
          ) : (
            <li key={number}>
              {number === current ? (
                <span
                  aria-current="page"
                  className={cn(STEP, "border-primary bg-primary-tint text-primary")}
                >
                  {number} <VisuallyHidden>{translate("blog.pagination.current")}</VisuallyHidden>
                </span>
              ) : (
                <Link
                  href={hrefFor(number)}
                  className={cn(
                    STEP,
                    "border-line-strong bg-surface text-ink no-underline hover:border-primary",
                  )}
                >
                  {number}{" "}
                  <VisuallyHidden>
                    {translate("blog.pagination.goTo", { page: number })}
                  </VisuallyHidden>
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      {current < pageCount ? (
        <Link
          href={hrefFor(current + 1)}
          className={cn(
            STEP,
            "border-line-strong bg-surface text-ink no-underline hover:border-primary",
          )}
        >
          <span>{translate("blog.pagination.next")}</span>
          <Icon icon={ChevronRight} />{" "}
          <VisuallyHidden>
            {translate("blog.pagination.goTo", { page: current + 1 })}
          </VisuallyHidden>
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(STEP, "border-line text-subtle")}>
          <span>{translate("blog.pagination.next")}</span>
          <Icon icon={ChevronRight} />
        </span>
      )}
    </nav>
  );
}

export { PaginationBar, visiblePages };
