/**
 * ChoiceCards: choose one of a few options drawn as large cards, such as "Sell" or "Rent out".
 * Purpose: the first question of the post-property wizard (S6-T02, FR-ACC-06). Owner: design system.
 * Props: legend (the question, already translated), hideLegend (say it to a screen reader only, for a group that
 *   a heading above already names), name, options ({ value, label, hint?, visual? }; visual is a small drawing
 *   of the choice, shown above its name and hidden from screen readers), value, onChange, error (already-translated
 *   message), disabled, className.
 * Responsive: two cards side by side from 768 px, one under the other below that.
 * Accessibility: native radio buttons in a fieldset with a legend, so one tab stop for the group and the
 *   arrow keys move and choose; each radio covers its whole card, so the focus ring is drawn around the
 *   card; the chosen card also shows a tick, so the choice is not shown by colour alone; an error is
 *   text with an icon and is tied to the group.
 * States: none chosen, chosen, hover, focus, disabled, error.
 * Dependencies: Icon, cn. Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: post-property screen, "I want to" (seg-cards).
 */
import { Check, CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ChoiceOption = { value: string; label: string; hint?: string; visual?: ReactNode };

type ChoiceCardsProps = {
  legend: string;
  hideLegend?: boolean;
  name: string;
  options: ChoiceOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  className?: string;
};

function ChoiceCards({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
  error,
  disabled = false,
  className,
}: ChoiceCardsProps) {
  const errorId = useId();
  return (
    <fieldset
      data-slot="choice-cards"
      disabled={disabled}
      aria-describedby={error ? errorId : undefined}
      className={cn("min-w-0", className)}
    >
      <legend className={cn("text-small font-semibold text-ink", hideLegend ? "sr-only" : "mb-2")}>
        {legend}
      </legend>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative block cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer absolute inset-0 z-10 m-0 cursor-[inherit] appearance-none rounded-lg"
            />
            <span
              className={cn(
                "pointer-events-none flex items-start justify-between gap-3 rounded-lg border-[length:var(--bw-field)] bg-surface p-4",
                "transition-colors duration-(--dur-fast) peer-hover:border-primary",
                "peer-checked:border-primary peer-checked:bg-primary-tint",
                error ? "border-danger" : "border-line-input",
              )}
            >
              <span className={cn("flex min-w-0 flex-col gap-1", option.visual && "flex-1")}>
                {option.visual ? (
                  <span aria-hidden="true" className="mb-2 block">
                    {option.visual}
                  </span>
                ) : null}
                <span className="font-bold text-ink">{option.label}</span>
                {option.hint ? <span className="text-small text-muted">{option.hint}</span> : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-pill border-[length:var(--bw-field)] border-line-input text-on-primary",
                  value === option.value && "border-primary bg-primary",
                )}
              >
                {value === option.value ? <Icon icon={Check} size="sm" /> : null}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-2 text-small text-danger">
          <Icon icon={CircleAlert} size="sm" className="mt-1" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

export { ChoiceCards };
export type { ChoiceCardsProps, ChoiceOption };
