/**
 * NextSteps: a small box that says what happens after the reader acts: an icon, a title and a sentence.
 * Purpose: "What happens next" under the review of a listing (S6-T02, FR-ACC-06). Owner: design system.
 *   It holds no state: the page passes the words, already translated.
 * Props: icon (a Lucide icon; a clock by default), title, children (the sentence), as (heading level
 *   for the title, "h3" by default), className.
 * Responsive: the icon beside the text at every width.
 * Accessibility: the title is a heading of the level the page asks for; the icon is decoration.
 * States: default only. Dependencies: Icon, cn.
 * Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: post-property screen, step 5 (next-box).
 */
import { Clock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type NextStepsProps = {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
};

function NextSteps({ icon = Clock, title, children, as: Tag = "h3", className }: NextStepsProps) {
  return (
    <div
      data-slot="next-steps"
      className={cn("flex items-start gap-4 rounded-lg bg-primary-tint p-4", className)}
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-md bg-surface text-primary"
      >
        <Icon icon={icon} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Tag className="text-title-sm text-ink">{title}</Tag>
        <p className="text-small text-muted">{children}</p>
      </div>
    </div>
  );
}

export { NextSteps };
export type { NextStepsProps };
