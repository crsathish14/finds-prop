/**
 * VisuallyHidden: text that only screen readers see.
 * Purpose: a name for something that is clear by sight, such as "(opens in a new tab)" or a table
 *   caption. Owner: design system.
 * Props: children (already-translated text), as ("span" default | "div"), className.
 * Responsive: none. Accessibility: stays in the reading order; do not use it to hide things from sighted readers that they need.
 * States: none. Dependencies: Tailwind sr-only.
 * Tests: navigation.test.tsx.
 * UX reference: ds-foundations, accessibility.
 */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type VisuallyHiddenProps = Omit<ComponentProps<"span">, "ref"> & { as?: "span" | "div" };

function VisuallyHidden({ as: Tag = "span", className, ...props }: VisuallyHiddenProps) {
  return <Tag className={cn("sr-only", className)} {...props} />;
}

export { VisuallyHidden };
