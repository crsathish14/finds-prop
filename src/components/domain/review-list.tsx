/**
 * ReviewList: a short summary of what was entered, one row per answer, each with an Edit button.
 * Purpose: the last step of the post-property wizard, "Review and submit" (S6-T02, FR-ACC-06). Owner:
 *   design system. It holds no state: the page passes the rows, already translated.
 * Props: rows ({ id, label, value, editText, editFor, onEdit }; value may hold text, a number or a small
 *   element such as a thumbnail row), className. `editFor` names the answer for a screen reader
 *   ("Edit price"), because several Edit buttons on one page need different names.
 * Responsive: the label above the answer on phones; label, answer and Edit on one line from 640 px.
 * Accessibility: a description list (term, then its answer, with the Edit button inside the answer, as the HTML rules ask); each Edit is a real button whose visible
 *   word is "Edit", followed by hidden text saying what it edits.
 * States: any number of rows; a long answer wraps; an empty answer shows a dash.
 * Dependencies: Button, VisuallyHidden, cn. Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: post-property screen, step 5 (review-list, rv).
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type ReviewRow = {
  id: string;
  label: string;
  value: ReactNode;
  /** The visible word, such as "Edit". */
  editText: string;
  /** What the button edits, heard after the visible word by a screen reader, such as "price". */
  editFor: string;
  onEdit: () => void;
};

type ReviewListProps = { rows: ReviewRow[]; className?: string };

function ReviewList({ rows, className }: ReviewListProps) {
  return (
    <dl
      data-slot="review-list"
      className={cn("divide-y divide-line rounded-lg border border-line", className)}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
        >
          <dt className="pt-2 text-small font-semibold text-muted">{row.label}</dt>
          <dd className="flex min-w-0 items-start justify-between gap-4">
            <span className="min-w-0 pt-2 text-body break-words text-ink">
              {row.value === null || row.value === undefined || row.value === "" ? "–" : row.value}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={row.onEdit}>
              {row.editText} <VisuallyHidden>{row.editFor}</VisuallyHidden>
            </Button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { ReviewList };
export type { ReviewListProps, ReviewRow };
