/**
 * SectionGrid: the grid that lays out the cards of a homepage section.
 * Purpose: one place for the columns and gaps of the four kinds of card row on the homepage, so the
 *   Design Lab, the homepage and any later page agree. Owner: design system. It holds no words.
 * Props: variant ("tiles" locality tiles | "categories" category cards | "values" value cards),
 *   children, className.
 * Responsive: tiles are 2 across on a phone, 3 from 768 px and 5 from 1100 px; category cards are 1,
 *   then 2 from 768 px and 4 from 1100 px; value cards are 1, then 3 from 768 px. The gaps grow with
 *   the columns.
 * Accessibility: layout only. Each child is its own link or card.
 * States: none.
 * Dependencies: cva, cn.
 * Tests: home-section.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens (s-home.css .cat-grid and .value-grid, c-cards.css .tiles). The UX
 *   changes columns at 640 px, which is not a breakpoint of this site, so 768 px is used; its 14 px
 *   gaps are 16 px.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const gridStyles = cva("grid", {
  variants: {
    variant: {
      tiles: "grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 portal:grid-cols-5",
      categories: "gap-4 md:grid-cols-2 portal:grid-cols-4 portal:gap-5",
      values: "gap-4 md:grid-cols-3 md:gap-5",
    },
  },
});

type SectionGridProps = Required<VariantProps<typeof gridStyles>> & {
  children: ReactNode;
  className?: string;
};

function SectionGrid({ variant, children, className }: SectionGridProps) {
  return (
    <div data-slot="section-grid" className={cn(gridStyles({ variant }), className)}>
      {children}
    </div>
  );
}

export { SectionGrid };
