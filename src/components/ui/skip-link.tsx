/**
 * SkipLink: the first focusable thing on every page, which jumps past the header to the content.
 * Purpose: keyboard and screen reader readers reach the main content in one key press. Owner:
 *   design system. Place it first inside <body>, and give the main element id="main".
 * Props: href ("#main" by default), children (already-translated text, e.g. "Skip to content").
 * Responsive: invisible until focused, then shown at the top left.
 * Accessibility: WCAG 2.4.1 (bypass blocks). Styled by .skip-link in globals.css.
 * States: hidden, focused. Dependencies: none.
 * Tests: navigation.test.tsx; E2E smoke checks it is first in the tab order.
 * UX reference: ds-foundations, focus (base.css .skip).
 */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

function SkipLink({ href = "#main", className, ...props }: Omit<ComponentProps<"a">, "ref">) {
  return <a href={href} className={cn("skip-link", className)} {...props} />;
}

export { SkipLink };
