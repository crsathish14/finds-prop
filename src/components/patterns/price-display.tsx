/**
 * PriceDisplay: a property price the way the site shows it: ₹78 L, ₹1.25 Cr, ₹48,000/mo.
 * Purpose: one component for every price, so two screens never format a price differently.
 *   Owner: design system. The numbers and words come from src/lib/format.ts and en.json (R-FE-23).
 * Props: rupees (whole rupees, required), listingType ("sale" default | "rent", which adds /mo),
 *   perSqftRupees (sale only: adds "₹6,500 per sq.ft" under the price), size ("default" | "large"),
 *   className.
 * Responsive: fixed type size; the per-sq.ft line wraps under the price when space is short.
 * Accessibility: plain text. Tabular, lining numerals keep prices aligned in lists.
 * States: none. Dependencies: Price, format helpers, next-intl.
 * Tests: display.test.tsx; Design Lab "Card parts" (S2-T07).
 * UX reference: ds-components, price (c-cards.css .price, .price-lg).
 */
import { useLocale, useTranslations } from "next-intl";
import { Price } from "@/components/ui/price";
import { Text } from "@/components/ui/text";
import { formatPerSqft, formatPrice, formatRent, type Translate } from "@/lib/format";

type PriceDisplayProps = {
  rupees: number;
  listingType?: "sale" | "rent";
  perSqftRupees?: number;
  size?: "default" | "large";
  className?: string;
};

function PriceDisplay({
  rupees,
  listingType = "sale",
  perSqftRupees,
  size,
  className,
}: PriceDisplayProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const price =
    listingType === "rent"
      ? formatRent(translate, locale, rupees)
      : formatPrice(translate, locale, rupees);
  // R-FE: the per sq.ft line is for sale listings only.
  const perSqft =
    listingType === "sale" && perSqftRupees !== undefined
      ? formatPerSqft(translate, locale, perSqftRupees)
      : null;
  return (
    <span data-slot="price-display" className={className}>
      <Price size={size}>{price}</Price>
      {perSqft ? (
        <Text as="span" variant="caption" tone="muted" className="ml-2">
          {perSqft}
        </Text>
      ) : null}
    </span>
  );
}

export { PriceDisplay };
