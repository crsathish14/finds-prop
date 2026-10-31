/**
 * StatTile: one headline number with a label, for dashboards.
 * Purpose: the count and total tiles in the owner, builder and admin dashboards. Owner: design system.
 * Props: label and value (already-formatted text or a number), icon (an Icon element, optional),
 *   iconTone ("primary" default | "copper" | "info" | "warning"), note (a smaller line below),
 *   attention (tints the tile to say it needs a look), className.
 * Responsive: two columns on phones in a grid owned by the page; the tile fills its cell.
 * Accessibility: label and value are plain text in reading order. "Needs attention" must also be
 *   said in the note or label, never by the tint alone.
 * States: default, attention. Dependencies: cva, cn.
 * Tests: display.test.tsx; Design Lab "Card parts" (S2-T07).
 * UX reference: ds-components, stat tile (c-cards.css .stat).
 */
import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const discStyles = cva("grid size-9 shrink-0 place-items-center rounded-pill", {
  variants: {
    tone: {
      primary: "bg-primary-tint text-primary",
      copper: "bg-cta-tint text-cta-text",
      info: "bg-info-tint text-info",
      warning: "bg-warning-tint text-warning",
    },
  },
  defaultVariants: { tone: "primary" },
});

type StatTileProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  iconTone?: "primary" | "copper" | "info" | "warning";
  note?: string;
  attention?: boolean;
  className?: string;
};

function StatTile({
  label,
  value,
  icon,
  iconTone,
  note,
  attention = false,
  className,
}: StatTileProps) {
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-line px-5 py-4",
        attention ? "border-warning/30 bg-warning-tint" : "bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-small font-semibold text-muted">{label}</span>
        {icon ? <span className={discStyles({ tone: iconTone })}>{icon}</span> : null}
      </div>
      <span className="text-stat text-ink">{value}</span>
      {note ? <span className="text-caption text-muted">{note}</span> : null}
    </div>
  );
}

export { StatTile };
