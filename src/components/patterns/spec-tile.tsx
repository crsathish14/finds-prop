/**
 * SpecTile: one fact about a property: a small label over a value, with an optional icon.
 * Purpose: the spec grid on a property page (bedrooms, area, facing...). Owner: design system.
 * Props: label and value (already-translated or formatted text), icon (an Icon element, optional),
 *   missing (the value is not known: shows `value` quietly, e.g. "Not provided"), className.
 * Responsive: two columns on phones in a grid owned by the page; long values wrap.
 * Accessibility: label and value are plain text in reading order. A missing value is still text.
 * States: default, missing. Dependencies: cn.
 * Tests: display.test.tsx; Design Lab "Card parts" (S2-T07).
 * UX reference: ds-components, spec tile (c-cards.css .spec).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SpecTileProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  missing?: boolean;
  className?: string;
};

function SpecTile({ label, value, icon, missing = false, className }: SpecTileProps) {
  return (
    <div
      data-slot="spec-tile"
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3",
        className,
      )}
    >
      {icon ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-tint text-primary">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <span className="block text-overline text-muted">{label}</span>
        <span
          className={cn(
            "mt-1 block text-title-sm [overflow-wrap:anywhere]",
            missing ? "font-medium text-subtle" : "text-ink",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export { SpecTile };
