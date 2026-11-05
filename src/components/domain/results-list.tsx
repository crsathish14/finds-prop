/**
 * ResultsGrid, ResultsSkeleton, ResultsLoadMore, ResultsEmpty, ResultsError: the body of a results page.
 * Purpose: lays the property cards out as a grid or a list, and draws the states around them: loading,
 *   "Show more" with its count, no match, and a failed load. Owner: design system. They hold no state
 *   and fetch nothing: the page passes the cards and the actions.
 * Props:
 *   ResultsGrid: view ("grid" | "list"), children (one card each), className.
 *   ResultsSkeleton: view, count (default 6).
 *   ResultsLoadMore: shown, total, onShowMore, loading, atLimit (the 120-home cap: the button becomes
 *     "Refine your search" and calls onRefine), onRefine.
 *   ResultsEmpty: onClearAll, describeHref (the "Describe it in words" link; give it only when AI
 *     search is on, otherwise nothing is drawn for it).
 *   ResultsError: onRetry (the filters are kept by the page).
 * Responsive: the grid follows the width of the results area itself (container queries at 576 and
 *   896 px: 1, 2 and 3 across), because the rail takes a share of wide screens. The list is one card
 *   per row; each card puts its picture beside the text when its own box is wide enough.
 * Accessibility: the loading block is aria-busy and named "Loading homes"; the empty state is a status
 *   with a heading; the error is an alert; the count is a polite live region (ShowMore).
 * States: grid, list, loading (both), load more (default, loading, complete, at the limit), empty
 *   (with and without the AI link), error.
 * Dependencies: PropertyCardSkeleton, ShowMore, EmptyState, Alert, Button, Link, next-intl.
 * Tests: results.test.tsx; Design Lab "Domain" (S4-T04).
 * UX reference: search screen, states default, list, loading, empty and error.
 */
import { RefreshCw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import { EmptyState } from "@/components/patterns/empty-state";
import { ShowMore } from "@/components/patterns/show-more";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { PropertyCardSkeleton } from "./property-card";
import type { ResultsView } from "./results-bar";

const GRID = "grid grid-cols-1 gap-5 @xl:grid-cols-2 @4xl:grid-cols-3";
const LIST = "grid grid-cols-1 gap-5";

function ResultsGrid({
  view,
  children,
  className,
}: {
  view: ResultsView;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="@container">
      <div data-slot="results-grid" className={cn(view === "list" ? LIST : GRID, className)}>
        {children}
      </div>
    </div>
  );
}

function ResultsSkeleton({
  view,
  count = 6,
  className,
}: {
  view: ResultsView;
  count?: number;
  className?: string;
}) {
  const translate = useTranslations();
  return (
    <div
      data-slot="results-skeleton"
      aria-busy="true"
      aria-label={translate("domain.results.loading")}
      role="status"
      className="@container"
    >
      <div className={cn(view === "list" ? LIST : GRID, className)}>
        {Array.from({ length: count }, (_, index) => (
          <PropertyCardSkeleton key={index} layout={view} />
        ))}
      </div>
    </div>
  );
}

type ResultsLoadMoreProps = {
  shown: number;
  total: number;
  onShowMore: () => void;
  loading?: boolean;
  atLimit?: boolean;
  onRefine?: () => void;
  className?: string;
};

function ResultsLoadMore({
  shown,
  total,
  onShowMore,
  loading,
  atLimit = false,
  onRefine,
  className,
}: ResultsLoadMoreProps) {
  const translate = useTranslations();
  return (
    <ShowMore
      shown={shown}
      total={total}
      progressLabel={translate("domain.results.loadMore.progress", { shown, total })}
      buttonLabel={translate(
        atLimit ? "domain.results.loadMore.refine" : "domain.results.loadMore.button",
      )}
      onShowMore={atLimit ? (onRefine ?? onShowMore) : onShowMore}
      {...(loading === undefined ? {} : { loading })}
      {...(className === undefined ? {} : { className })}
    />
  );
}

function ResultsEmpty({
  onClearAll,
  describeHref,
  className,
}: {
  onClearAll: () => void;
  describeHref?: string | undefined;
  className?: string;
}) {
  const translate = useTranslations();
  return (
    <div role="status" data-slot="results-empty">
      <EmptyState
        as="h2"
        title={translate("domain.results.empty.title")}
        description={translate("domain.results.empty.body")}
        {...(className === undefined ? {} : { className })}
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onClearAll}>{translate("domain.results.empty.clearAll")}</Button>
          {describeHref ? (
            <Button asChild variant="secondary">
              <Link href={describeHref} className="text-primary no-underline hover:text-primary">
                <Icon icon={Sparkles} size="sm" />
                {translate("domain.results.empty.describe")}
              </Link>
            </Button>
          ) : null}
        </div>
      </EmptyState>
    </div>
  );
}

function ResultsError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  const translate = useTranslations();
  return (
    <Alert
      tone="danger"
      title={translate("domain.results.error.title")}
      {...(className === undefined ? {} : { className })}
      action={
        <Button
          variant="danger-outline"
          size="sm"
          iconStart={<Icon icon={RefreshCw} size="sm" />}
          onClick={onRetry}
        >
          {translate("domain.results.error.retry")}
        </Button>
      }
    >
      {translate("domain.results.error.body")}
    </Alert>
  );
}

export { ResultsEmpty, ResultsError, ResultsGrid, ResultsLoadMore, ResultsSkeleton };
