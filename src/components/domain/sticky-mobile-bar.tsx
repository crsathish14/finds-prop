/**
 * StickyMobileBar: the bar pinned to the bottom of a phone's screen on a property page: the price on
 *   the left and the one button to enquire on the right.
 * Purpose: keeps the price and the way to contact the owner in reach while a visitor scrolls the
 *   photos and the details. Owner: design system. It holds no state: the page decides when to draw
 *   it (not while the enquiry sheet is open, after an enquiry is sent, while loading or on not found)
 *   and what the button does.
 * Props: rupees, listingType ("sale" default | "rent"), perSqftRupees (sale only), action (the
 *   copper button: { label, href } for a link, such as "Sign in to enquire", or { label, onClick }
 *   for a button that opens the enquiry sheet, such as "Enquire"; the label is already translated),
 *   className.
 * Responsive: drawn below 1024 px only; from 1024 px the price card and the enquiry card beside the
 *   details do this job. The price takes the room the button leaves and is cut with no wrapping of
 *   the button. It leaves room for a phone's home bar (the safe area) under its content.
 * Accessibility: the button is a real link or button named by its label; the price is plain text. The
 *   page must leave room under its last section so the bar never hides content.
 * States: link, button; sale with and without the price per square foot; rent.
 * Dependencies: PriceDisplay, Button, Link, cn.
 * Tests: price-and-bar.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: property screen, mobile bar (s-browse.css .mbar). The UX price is 20 px; so is this.
 *   The copper button here and the card’s copper button are never on screen together: this bar is
 *   hidden from 1024 px up and the card is hidden below it.
 */
import { PriceDisplay } from "@/components/patterns/price-display";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";

type StickyMobileBarAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type StickyMobileBarProps = {
  rupees: number;
  listingType?: "sale" | "rent";
  perSqftRupees?: number | undefined;
  action: StickyMobileBarAction;
  className?: string;
};

function StickyMobileBar({
  rupees,
  listingType = "sale",
  perSqftRupees,
  action,
  className,
}: StickyMobileBarProps) {
  return (
    <div
      data-slot="sticky-mobile-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky border-t border-line-strong bg-surface shadow-float lg:hidden",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-gutter py-3">
        <div className="min-w-0 flex-1">
          <PriceDisplay
            rupees={rupees}
            listingType={listingType}
            {...(perSqftRupees === undefined ? {} : { perSqftRupees })}
          />
        </div>
        {action.href !== undefined ? (
          <Button asChild variant="accent">
            <Link href={action.href} className="text-on-cta no-underline hover:text-on-cta">
              {action.label}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="accent" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
      {/* The phone's home bar, so the button is never under it. */}
      <div aria-hidden="true" className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

export { StickyMobileBar };
export type { StickyMobileBarAction };
