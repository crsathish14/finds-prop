/**
 * Price: the look of a price. It styles text that is already formatted.
 * Purpose: one place for price type (bold figures, lining and tabular numerals). The formatting
 *   itself (lakh, crore, rent, per sq.ft) is done by src/lib/format.ts and wrapped by PriceDisplay
 *   (S2-T05). Owner: design system.
 * Props: size ("default" | "large"), className; children is the formatted price.
 * Responsive: fixed size on every screen.
 * Accessibility: plain inline text, so screen readers read the words the formatter produced.
 * States: none. Dependencies: cva, cn, tokens (text-price, text-price-lg).
 * Tests: typography.test.tsx, Design Lab "Type" (S2-T07).
 * UX reference: ds-foundations, Type; price styles in c-cards.css.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const priceStyles = cva("", {
  variants: {
    size: {
      default: "text-price text-ink",
      large: "text-price-lg text-primary",
    },
  },
  defaultVariants: { size: "default" },
});

type PriceProps = Omit<ComponentProps<"span">, "ref"> & VariantProps<typeof priceStyles>;

function Price({ size, className, ...props }: PriceProps) {
  return <span className={cn(priceStyles({ size }), className)} {...props} />;
}

export { Price };
