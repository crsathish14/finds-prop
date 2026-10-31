/**
 * Icon: a Lucide icon at a standard size.
 * Purpose: one way to show an icon, so sizes and the screen reader rule are the same everywhere.
 *   Owner: design system. The arch mark and the illustration are separate custom components.
 * Props: icon (a Lucide icon component, required), size ("sm" 16 px | "md" 20 px default | "lg" 24 px),
 *   label (already-translated text; leave it out when the icon is decoration), className.
 * Responsive: fixed sizes; it takes the colour of the surrounding text.
 * Accessibility: decorative by default (hidden from screen readers). With a label it becomes an
 *   image with that name. Never use an icon as the only content of a button without a label.
 * States: none. Dependencies: lucide-react, cva, cn.
 * Tests: navigation.test.tsx; Design Lab "Foundations" (S2-T07).
 * UX reference: ds-foundations, Icons (2 px round stroke).
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const iconStyles = cva("shrink-0", {
  variants: { size: { sm: "size-4", md: "size-5", lg: "size-6" } },
  defaultVariants: { size: "md" },
});

type IconProps = VariantProps<typeof iconStyles> & {
  icon: LucideIcon;
  label?: string;
  className?: string;
};

function Icon({ icon: Glyph, size, label, className }: IconProps) {
  const classes = cn(iconStyles({ size }), className);
  if (!label) return <Glyph aria-hidden="true" className={classes} />;
  return <Glyph role="img" aria-label={label} className={classes} />;
}

export { Icon };
export type { LucideIcon };
