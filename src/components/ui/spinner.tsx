/**
 * Spinner: a turning ring that shows work is in progress.
 * Purpose: one place for the loading indicator. Owner: design system.
 * Props: size ("sm" 20 px default | "md" 28 px | "lg" 40 px), label (already-translated text for
 *   screen readers; leave it out when something nearby already says "loading"), className.
 * Responsive: fixed sizes. It takes the colour of the surrounding text.
 * Accessibility: with a label it is role="status" with the label read aloud; without one it is
 *   hidden from screen readers. The turn stops under prefers-reduced-motion (globals.css).
 * States: spinning only. Dependencies: cva, cn.
 * Tests: feedback.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, loading (c-core.css spin).
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const spinnerStyles = cva(
  "inline-block shrink-0 animate-spin rounded-pill border-2 border-current/40 border-t-current",
  {
    variants: { size: { sm: "size-5", md: "size-7", lg: "size-10" } },
    defaultVariants: { size: "sm" },
  },
);

type SpinnerProps = Omit<ComponentProps<"span">, "ref" | "children"> &
  VariantProps<typeof spinnerStyles> & { label?: string };

function Spinner({ size, label, className, ...props }: SpinnerProps) {
  const classes = cn(spinnerStyles({ size }), className);
  if (!label) return <span aria-hidden="true" className={classes} {...props} />;
  return (
    <span role="status" className="inline-flex" {...props}>
      <span aria-hidden="true" className={classes} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner };
