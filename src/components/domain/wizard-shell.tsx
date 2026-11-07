/**
 * WizardShell: the frame of the post-property wizard: the heading, the list of steps, the card the
 * current step sits in, and the Back / Continue bar.
 * Purpose: the page around the five steps (S6-T02, FR-ACC-06). Owner: design system. It holds no state and
 *   fetches nothing: the page passes the words (already translated), the steps and the step's content.
 * Props: title and emphasis (the heading, with one part of it in italic copper), description, steps and progressLabel (as
 *   Stepper), alert (a message at the top of the card, such as "We couldn't submit your listing"),
 *   children (the current step), footer (a WizardFooter), titleAs and titleId, className.
 * Responsive: a list of steps beside the card from 768 px; on phones a segmented bar with the step's name
 *   under it, and the footer becomes a bar fixed to the bottom of the screen (room is left for it).
 * Accessibility: the heading is a level 1 by default; the steps are an ordered list with the current one
 *   marked; the card is a labelled region; the phone's step line is plain text (the bar is hidden from
 *   screen readers except for its label).
 * States: any step, with or without an alert at the top. Dependencies: Stepper, Container, Heading, Text.
 * Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: post-property screen (wiz, wiz-steps, wiz-card, wiz-mobile-head).
 */
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Stepper, type Step } from "@/components/patterns/stepper";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type WizardShellProps = {
  title: string;
  /** The part of the title shown in italic copper; left out, the title is plain. */
  emphasis?: string;
  description: string;
  steps: Step[];
  /** "Step 2 of 5: Details": names the phone bar and is also shown as the line under it. */
  progressLabel: string;
  alert?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  titleAs?: "h1" | "h2";
  titleId?: string;
  className?: string;
};

function WizardShell({
  title,
  emphasis,
  description,
  steps,
  progressLabel,
  alert,
  children,
  footer,
  titleAs = "h1",
  titleId = "wizard-title",
  className,
}: WizardShellProps) {
  return (
    <Container data-slot="wizard-shell" className={cn("py-6 pb-24 md:py-10 md:pb-10", className)}>
      <div className="mb-6 flex flex-col gap-2 md:mb-8">
        <Heading as={titleAs} size="1" id={titleId} tabIndex={-1}>
          <TitleWithEmphasis title={title} emphasis={emphasis} />
        </Heading>
        <Text tone="muted">{description}</Text>
      </div>
      <div className="grid gap-6 md:grid-cols-3 md:items-start lg:grid-cols-4 lg:gap-10">
        <div>
          <Stepper steps={steps} progressLabel={progressLabel} />
          <p className="mt-3 text-small text-muted md:hidden">{progressLabel}</p>
        </div>
        <section
          aria-labelledby={titleId}
          className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-5 md:col-span-2 md:p-8 lg:col-span-3"
        >
          {alert}
          {children}
          {footer}
        </section>
      </div>
    </Container>
  );
}

export { WizardShell };
export type { WizardShellProps };
