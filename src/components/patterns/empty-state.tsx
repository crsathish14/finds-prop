/**
 * EmptyState: what to show when a list or page has nothing in it.
 * Purpose: one friendly pattern: the arch drawing, a title saying what is missing, one sentence,
 *   and at most one next step. Owner: design system.
 * Props: title and description (already-translated), as (heading level for the title, "h2" by
 *   default; use "h1" when the page has no other heading, as on a not-found page; choose the level that fits the page outline), children (the single next step, usually
 *   a Button or Link), className.
 * Responsive: centred; the text is capped at 46 characters wide.
 * Accessibility: the title is a real heading; the drawing is hidden from screen readers.
 * States: none. Dependencies: ArchIllustration, Heading, Text.
 * Tests: display.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, empty states (c-core.css .empty).
 */
import type { ReactNode } from "react";
import { ArchIllustration } from "@/components/ui/arch-illustration";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description: string;
  as?: "h1" | "h2" | "h3" | "h4";
  children?: ReactNode;
  className?: string;
};

function EmptyState({ title, description, as = "h2", children, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border-[length:var(--bw-field)] border-dashed border-line-strong bg-surface/60 px-6 pt-10 pb-10 text-center",
        className,
      )}
    >
      <ArchIllustration className="mb-2" />
      <Heading as={as} size="3">
        {title}
      </Heading>
      <Text tone="muted" className="max-w-[46ch]">
        {description}
      </Text>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export { EmptyState };
