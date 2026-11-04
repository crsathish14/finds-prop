/**
 * ValueCard: one short reason to use Find Prop: an icon, a title and a sentence.
 * Purpose: the three cards of "Why Find Prop" on the homepage. Owner: design system. It holds no
 *   state and fetches nothing: the page passes the words, already translated.
 * Props: icon (a Lucide icon), title, description, className.
 * Responsive: one card per row on a phone and three from 768 px (the grid around it decides).
 * Accessibility: the title is a level 3 heading, so the card sits under the section's level 2. The
 *   icon is decoration. Not a link: there is nothing to press.
 * States: default only.
 * Dependencies: Icon, cn.
 * Tests: section-blocks.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, Why Find Prop (s-home.css .valuecard). The title is 17 px and the
 *   sentence 14 px, the nearest sizes of the type scale to the UX's 18 px and 15 px.
 */
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ValueCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

function ValueCard({ icon, title, description, className }: ValueCardProps) {
  return (
    <div
      data-slot="value-card"
      className={cn("rounded-xl border border-line bg-surface p-6", className)}
    >
      <span
        aria-hidden="true"
        className="mb-4 grid size-11.5 place-items-center rounded-md bg-primary-tint text-primary"
      >
        <Icon icon={icon} size="lg" />
      </span>
      <h3 className="text-title text-ink">{title}</h3>
      <p className="mt-1 text-small text-muted">{description}</p>
    </div>
  );
}

export { ValueCard };
