"use client";

/**
 * ShowMore: "Showing 12 of 48" with a progress bar and a button that loads more.
 * Purpose: the pagination for search results and lists. Owner: design system.
 * Props: shown and total (numbers, for the bar), progressLabel (already-translated, e.g. "Showing
 *   12 of 48"), buttonLabel (e.g. "Show more homes"), onShowMore, loading, className. When shown
 *   reaches total the button is not rendered.
 * Responsive: centred, the button fills a phone-width row.
 * Accessibility: the count is a polite live region, so it is read after new items load; the bar is
 *   a real progress element named by the count. After loading, the page moves keyboard focus to the
 *   first new item (UX section 2); that is done by the list, not here.
 * States: default, loading, complete. Dependencies: Button.
 * Tests: display.test.tsx; Design Lab "Card parts" (S2-T07).
 * UX reference: ds-components, show more (interaction-specifications section 2).
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ShowMoreProps = {
  shown: number;
  total: number;
  progressLabel: string;
  buttonLabel: string;
  onShowMore: () => void;
  loading?: boolean;
  className?: string;
};

function ShowMore({
  shown,
  total,
  progressLabel,
  buttonLabel,
  onShowMore,
  loading = false,
  className,
}: ShowMoreProps) {
  return (
    <div data-slot="show-more" className={cn("flex flex-col items-center gap-4", className)}>
      <p aria-live="polite" className="text-small font-semibold text-muted">
        {progressLabel}
      </p>
      <progress
        aria-label={progressLabel}
        value={shown}
        max={total}
        className="h-1.5 w-full max-w-72 appearance-none overflow-hidden rounded-pill bg-line-strong [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-line-strong [&::-webkit-progress-value]:bg-primary"
      />
      {shown < total ? (
        <Button variant="secondary" loading={loading} onClick={onShowMore}>
          {buttonLabel}
        </Button>
      ) : null}
    </div>
  );
}

export { ShowMore };
