/**
 * Stepper: the numbered steps of a long form, such as the post-property flow.
 * Purpose: shows where the reader is and what is done. Owner: design system.
 * Props: steps ({ label, description?, state, stateLabel? }; state is "done" | "current" |
 *   "upcoming" | "error"), progressLabel (required, already-translated, e.g. "Step 2 of 5: Details"),
 *   className. stateLabel is hidden text such as "Done" or "Needs attention", so a state is never
 *   only a colour or an icon.
 * Responsive: a vertical list from 768 px; on phones a segmented progress bar and the current step.
 * Accessibility: an ordered list; aria-current="step" on the current step; the phone bar is named
 *   by progressLabel.
 * States: done, current, upcoming, error. Dependencies: Icon, cn.
 * Tests: display.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-components, stepper and progress (c-data.css .stepper, .progress).
 */
import { Check, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type StepState = "done" | "current" | "upcoming" | "error";
type Step = { label: string; description?: string; state: StepState; stateLabel?: string };

type StepperProps = { steps: Step[]; progressLabel: string; className?: string };

const DISC_STYLES: Record<StepState, string> = {
  done: "border-primary bg-primary text-on-primary",
  current: "border-primary bg-primary text-on-primary",
  upcoming: "border-line-input bg-surface text-muted",
  error: "border-danger bg-danger text-on-primary",
};

function Stepper({ steps, progressLabel, className }: StepperProps) {
  return (
    <div data-slot="stepper" className={className}>
      <div role="img" aria-label={progressLabel} className="flex gap-2 md:hidden">
        {steps.map((step, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-pill",
              step.state === "done" || step.state === "current" ? "bg-primary" : "bg-line-strong",
              step.state === "error" && "bg-danger",
            )}
          />
        ))}
      </div>
      <ol className="hidden flex-col gap-1 md:flex">
        {steps.map((step, index) => (
          <li
            key={index}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "relative flex items-start gap-4 rounded-md px-3 py-3",
              step.state === "current" && "bg-surface outline outline-primary -outline-offset-1",
              index < steps.length - 1 &&
                "after:absolute after:top-12 after:-bottom-2 after:left-7 after:w-0.5 after:bg-line-strong",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-pill border-[length:var(--bw-field)] text-small font-bold",
                DISC_STYLES[step.state],
              )}
            >
              {step.state === "done" ? (
                <Icon icon={Check} size="sm" />
              ) : step.state === "error" ? (
                <Icon icon={X} size="sm" />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-title-sm text-ink">{step.label}</span>
              {step.description ? (
                <span className="block text-caption text-muted">{step.description}</span>
              ) : null}
              {step.stateLabel ? <span className="sr-only">{step.stateLabel}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export { Stepper };
export type { Step, StepState };
