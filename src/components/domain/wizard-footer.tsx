/**
 * WizardFooter: Back, Save draft and Continue (or Submit for review) at the foot of the wizard.
 * Purpose: moving between the steps of the post-property wizard (S6-T02, FR-ACC-06). Owner: design system.
 *   It holds no state: the page passes the words (already translated) and what each button does.
 * Props: back (label, onClick, disabled; left out on step 1), saveDraft (the same; shown from 768 px),
 *   next (label, onClick, kind "continue" | "submit", loading, disabled), className.
 * Responsive: a row at the foot of the card from 768 px; on phones a bar fixed to the bottom of the screen
 *   with Back and the main button only (the draft is saved by Continue). `WizardShell` leaves room for it.
 *   When Back and a long main label (such as "Resubmit for review") do not fit side by side on a very narrow
 *   screen, the main button drops to its own line instead of running off the edge.
 * Accessibility: native buttons in reading order (Back, Save draft, main); loading keeps the label, sets
 *   aria-busy and ignores clicks (Button); there is one copper button (Submit) and it only appears on the
 *   last step, the other steps use the forest Continue.
 * States: first step (no Back), middle step, last step, loading, disabled.
 * Dependencies: Button, Icon, cn. Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: post-property screen (wiz-foot, wiz-sticky). The UX draws Back as an outline button on
 *   phones and a quiet one beside Save draft; both are the quiet one here, so the bar has one look.
 */
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type FooterAction = { label: string; onClick: () => void; disabled?: boolean };

type WizardFooterProps = {
  back?: FooterAction;
  saveDraft?: FooterAction;
  next: FooterAction & { kind: "continue" | "submit"; loading?: boolean };
  className?: string;
};

function WizardFooter({ back, saveDraft, next, className }: WizardFooterProps) {
  return (
    <div
      data-slot="wizard-footer"
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-gutter py-3 shadow-float",
        "md:static md:z-auto md:flex-nowrap md:justify-between md:border-line md:bg-transparent md:px-0 md:pt-6 md:pb-0 md:shadow-none",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {back ? (
          <Button
            type="button"
            variant="ghost"
            iconStart={<Icon icon={ArrowLeft} size="sm" />}
            disabled={back.disabled ?? false}
            onClick={back.onClick}
          >
            {back.label}
          </Button>
        ) : null}
        {saveDraft ? (
          <Button
            type="button"
            variant="ghost"
            className="hidden md:inline-flex"
            disabled={saveDraft.disabled ?? false}
            onClick={saveDraft.onClick}
          >
            {saveDraft.label}
          </Button>
        ) : null}
      </div>
      <Button
        type="button"
        size="lg"
        variant={next.kind === "submit" ? "accent" : "primary"}
        className="flex-1 md:flex-none"
        loading={next.loading ?? false}
        disabled={next.disabled ?? false}
        onClick={next.onClick}
        {...(next.kind === "continue" ? { iconEnd: <Icon icon={ArrowRight} size="sm" /> } : {})}
      >
        {next.label}
      </Button>
    </div>
  );
}

export { WizardFooter };
export type { WizardFooterProps };
