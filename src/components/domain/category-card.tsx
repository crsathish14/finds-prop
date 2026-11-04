/**
 * CategoryCard: a tinted card that leads to one way of browsing.
 * Purpose: the "Browse by what matters" cards of the homepage (Featured, Prime, Budget, By
 *   locality). Owner: design system. It holds no state and fetches nothing: the page passes the
 *   words (already translated), the icon and where the card leads.
 * Props: icon (a Lucide icon), title, description, href, tint (1 to 4, the four tints of the UX in
 *   order: copper, green, sand, green), className.
 * Responsive: one card per row on a phone, two from 640 px and four from 1100 px (the grid around
 *   it decides). 164 px high or taller.
 * Accessibility: the whole card is one link named by its title and description. The icon and the
 *   copper arrow are decoration. Every tint keeps the text above 4.5 : 1.
 * States: default, hover (lifts three pixels and the arrow moves right), focus.
 * Dependencies: Link, Icon, cn.
 * Tests: section-blocks.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, Browse by what matters (s-home.css .catcard). The UX tints are
 *   hard-coded colours; these use the nearest palette tokens. The UX draws the arrow in green on
 *   the copper dot (about 1.7 : 1); it is white here, as the design system sets for copper.
 */
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";

type CategoryTint = 1 | 2 | 3 | 4;

type CategoryCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  tint?: CategoryTint;
  className?: string;
};

const TINTS: Record<CategoryTint, string> = {
  1: "bg-linear-160 from-cta-tint to-cta-tint-2",
  2: "bg-linear-160 from-primary-tint to-primary-tint-2",
  3: "bg-linear-160 from-neutral-tint to-line",
  4: "bg-linear-160 from-primary-tint to-primary-tint-2",
};

function CategoryCard({ icon, title, description, href, tint = 1, className }: CategoryCardProps) {
  return (
    <Link
      href={href}
      data-slot="category-card"
      data-tint={tint}
      className={cn(
        "group relative flex min-h-41 flex-col gap-1 rounded-xl px-6 pt-5 pb-5 text-primary no-underline",
        "transition-[transform,box-shadow] duration-(--dur) hover:-translate-y-0.75 hover:shadow-hover",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        TINTS[tint],
        className,
      )}
    >
      <Icon icon={icon} size="lg" className="mb-4 size-6.5" />
      <span className="text-h3 text-primary">{title}</span>
      {/* A real space between the two, so the link's name reads "Featured Hand-picked homes". */}{" "}
      <span className="max-w-[26ch] text-small font-medium text-muted">{description}</span>
      <span
        aria-hidden="true"
        className="absolute right-4.5 bottom-4.5 grid size-5.5 place-items-center rounded-pill bg-cta text-on-cta"
      >
        <Icon
          icon={ArrowRight}
          className="size-3.5 transition-transform duration-(--dur-fast) group-hover:translate-x-0.75 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        />
      </span>
    </Link>
  );
}

export { CategoryCard };
export type { CategoryTint };
