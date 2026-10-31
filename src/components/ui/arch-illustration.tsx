/**
 * ArchIllustration: a doorway drawing for empty states.
 * Purpose: the friendly picture above "nothing here yet" messages. Owner: design system.
 * Props: className (set the size; the drawing is 72 x 88 by default).
 * Responsive: scales with its size classes.
 * Accessibility: decoration only, hidden from screen readers; the message beside it says what is missing.
 * States: none. Dependencies: cn.
 * Tests: navigation.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, empty states (fp.js archArt).
 */
import { cn } from "@/lib/cn";

function ArchIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 88" aria-hidden="true" className={cn("h-22 w-18 shrink-0", className)}>
      <path
        d="M10 84V34a26 26 0 0 1 52 0v50"
        fill="none"
        stroke="var(--c-primary)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M22 84V38a14 14 0 0 1 28 0v46" fill="var(--c-primary-tint)" stroke="none" />
      <circle cx="43" cy="60" r="3.2" fill="var(--c-primary)" />
    </svg>
  );
}

export { ArchIllustration };
