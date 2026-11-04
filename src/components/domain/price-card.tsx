/**
 * PriceCard: the price of one home in the sticky column of the property page, with its tags.
 * Purpose: shows "For sale" and the label above the large price and the price per square foot.
 *   Owner: design system. It holds no state and fetches nothing: the page passes the price and the tags.
 * Props: rupees (whole rupees), listingType ("sale" default | "rent"), perSqftRupees (sale only; leave
 *   it out when the area is not known and the line is not drawn), badges (the tags drawn above the
 *   price, such as "For sale" and "Featured"), className.
 * Responsive: the card is as wide as its column; the large price is one size at every width.
 * Accessibility: plain text and the badges; no controls.
 * States: sale with and without the price per square foot, rent, with and without badges.
 * Dependencies: PriceDisplay, cn.
 * Tests: price-and-bar.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: property screen, price card (s-browse.css .price-card, base.css .price-lg). The UX
 *   corners are 22 px and the padding 22 px; here 24 px and 24 px (the nearest tokens).
 */
import type { ReactNode } from "react";
import { PriceDisplay } from "@/components/patterns/price-display";
import { cn } from "@/lib/cn";

type PriceCardProps = {
  rupees: number;
  listingType?: "sale" | "rent";
  perSqftRupees?: number | undefined;
  badges?: ReactNode;
  className?: string;
};

function PriceCard({
  rupees,
  listingType = "sale",
  perSqftRupees,
  badges,
  className,
}: PriceCardProps) {
  return (
    <div
      data-slot="price-card"
      className={cn("rounded-xl border border-line bg-surface p-6 pb-5", className)}
    >
      {badges ? <div className="mb-3 flex flex-wrap gap-2">{badges}</div> : null}
      <PriceDisplay
        rupees={rupees}
        listingType={listingType}
        {...(perSqftRupees === undefined ? {} : { perSqftRupees })}
        size="large"
      />
    </div>
  );
}

export { PriceCard };
