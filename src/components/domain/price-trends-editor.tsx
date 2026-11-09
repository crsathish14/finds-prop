"use client";

/**
 * PriceTrendsEditor: the admin's box for a project's monthly price per square foot.
 * Purpose: the figures behind the chart on the project page (S7-T02, FR-ADM-04); only the admin edits them and
 *   they are saved with the project. Owner: design system. It holds no state: the page keeps the rows and the
 *   errors, checks them (a month twice, a price out of range) and saves them.
 * Props: rows ({ id, month ("yyyy-mm" or ""), price (text, "" = not set) }), errors (by row id: { month?, price? },
 *   already translated), max (the most months), onAdd, onRemove (id), onChange (id, "month" or "price", value),
 *   disabled, words ({ title, description, month, price, monthFormat, add, remove(month), empty, full }, already
 *   translated), className.
 * Responsive: a card that fills its column; each row is a month box, a price box and a remove button on one line, down
 *   to the narrowest side column (320 px).
 * Accessibility: the card is a named group; every box has its own name (month, then its row number); the headings above
 *   the columns are for the eye, the boxes carry the names; the price keypad is numeric; a box with a problem is
 *   marked invalid and tied to its message, which also has an icon; the count (2 / 120) is text.
 * States: empty, some rows, rows with errors, full (Add month is off and the card says so), disabled (while saving).
 * Dependencies: Input, Button, IconButton, Icon, cn. Tests: media-and-trends.test.tsx; Design Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen, the Price trends box (.tbl with Month and per sq.ft, Add month).
 */
import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type PriceTrendRow = { id: string; month: string; price: string };

type PriceTrendRowErrors = { month?: string; price?: string };

type PriceTrendsWords = {
  title: string;
  description: string;
  /** The month column and the name of each month box: "Month". */
  month: string;
  /** The price column and the name of each price box: "₹ per sq.ft". */
  price: string;
  /** The hint inside an empty month box in a browser without a month picker: "yyyy-mm". */
  monthFormat: string;
  add: string;
  /** What the x says for a row: "Remove Oct 2026" (the page is given the month, or the row's number when empty). */
  remove: (month: string) => string;
  empty: string;
  full: string;
};

type PriceTrendsEditorProps = {
  rows: readonly PriceTrendRow[];
  errors?: Readonly<Record<string, PriceTrendRowErrors>>;
  max: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: "month" | "price", value: string) => void;
  disabled?: boolean;
  words: PriceTrendsWords;
  className?: string;
};

function PriceTrendsEditor({
  rows,
  errors = {},
  max,
  onAdd,
  onRemove,
  onChange,
  disabled = false,
  words,
  className,
}: PriceTrendsEditorProps) {
  const headingId = useId();
  const full = rows.length >= max;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-slot="price-trends-editor"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:p-6",
        className,
      )}
    >
      <h2 id={headingId} className="text-title font-bold text-ink">
        {words.title}
      </h2>
      <p className="text-small text-muted">{words.description}</p>
      {rows.length === 0 ? (
        <p className="rounded-md bg-canvas-sunken px-4 py-3 text-small text-muted">{words.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            aria-hidden="true"
            className="flex items-center gap-2 text-caption font-semibold text-muted"
          >
            <span className="min-w-0 flex-1">{words.month}</span>
            <span className="min-w-0 flex-1">{words.price}</span>
            <span className="size-(--size-icon-btn) shrink-0" />
          </div>
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const problem = errors[row.id] ?? {};
              const monthErrorId = `${headingId}-${row.id}-month`;
              const priceErrorId = `${headingId}-${row.id}-price`;
              return (
                <li key={row.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="month"
                      value={row.month}
                      disabled={disabled}
                      placeholder={words.monthFormat}
                      aria-label={`${words.month} ${index + 1}`}
                      aria-invalid={problem.month ? true : undefined}
                      aria-describedby={problem.month ? monthErrorId : undefined}
                      onChange={(event) => onChange(row.id, "month", event.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <Input
                      value={row.price}
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={disabled}
                      aria-label={`${words.price} ${index + 1}`}
                      aria-invalid={problem.price ? true : undefined}
                      aria-describedby={problem.price ? priceErrorId : undefined}
                      onChange={(event) => onChange(row.id, "price", event.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <IconButton
                      aria-label={words.remove(row.month || String(index + 1))}
                      disabled={disabled}
                      onClick={() => onRemove(row.id)}
                    >
                      <Icon icon={Trash2} />
                    </IconButton>
                  </div>
                  {problem.month ? (
                    <p
                      id={monthErrorId}
                      className="flex items-start gap-2 text-caption font-semibold text-danger"
                    >
                      <Icon icon={CircleAlert} size="sm" className="mt-px" />
                      {problem.month}
                    </p>
                  ) : null}
                  {problem.price ? (
                    <p
                      id={priceErrorId}
                      className="flex items-start gap-2 text-caption font-semibold text-danger"
                    >
                      <Icon icon={CircleAlert} size="sm" className="mt-px" />
                      {problem.price}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconStart={<Icon icon={Plus} />}
          disabled={disabled || full}
          onClick={onAdd}
        >
          {words.add}
        </Button>
        <p className="text-caption text-muted">
          {full ? `${words.full} ` : ""}
          {rows.length} / {max}
        </p>
      </div>
    </div>
  );
}

export { PriceTrendsEditor };
export type { PriceTrendRow, PriceTrendRowErrors, PriceTrendsEditorProps, PriceTrendsWords };
