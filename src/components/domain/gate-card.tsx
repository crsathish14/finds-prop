/**
 * GateCard: the centred card that stands in for a page until one thing is done, such as "Verify your
 * email to post a property".
 * Purpose: the posting gate and its "check your email" state (S6-T02, addendum ADD-03). Owner: design
 *   system. It holds no state and sends nothing: the page passes the words and the form or buttons.
 * Props: icon (a Lucide icon), tone ("info" | "success"), title, description, children (the form or the
 *   status line), note (a line at the foot with a tick, such as "Nothing you've entered is lost."),
 *   footer (a link under the card, such as "Not now, back to browsing"), as (heading level of the title,
 *   "h1" by default), className.
 * Responsive: up to 28 rem wide and centred; it fills a phone's width minus the gutters.
 * Accessibility: the title is the page's heading; the icon is decoration; when it shows a status
 *   (`status` true) the card is a live region so a change is announced.
 * States: ask, sent (the page changes `tone`, the icon and the words). Dependencies: Icon, Heading, cn.
 * Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: email prompts and gate (addendum ADD-03: auth-card, icon-disc, saved-note).
 */
import { CircleCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type GateCardProps = {
  icon: LucideIcon;
  tone?: "info" | "success";
  title: string;
  description: string;
  children?: ReactNode;
  note?: string;
  footer?: ReactNode;
  status?: boolean;
  as?: "h1" | "h2";
  className?: string;
};

function GateCard({
  icon,
  tone = "info",
  title,
  description,
  children,
  note,
  footer,
  status = false,
  as = "h1",
  className,
}: GateCardProps) {
  return (
    <div
      data-slot="gate-card"
      {...(status ? { role: "status" } : {})}
      className={cn(
        "mx-auto flex w-full max-w-md flex-col gap-5 rounded-xl border border-line bg-surface p-6 md:p-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-14 place-items-center rounded-pill",
          tone === "success" ? "bg-success-tint text-success" : "bg-info-tint text-info",
        )}
      >
        <Icon icon={icon} size="lg" />
      </span>
      <div className="flex flex-col gap-2">
        <Heading as={as} size="3">
          {title}
        </Heading>
        <p className="text-body text-muted">{description}</p>
      </div>
      {children}
      {note ? (
        <p className="flex items-start gap-2 text-small text-muted">
          <Icon icon={CircleCheck} size="sm" className="mt-0.5 text-success" />
          <span>{note}</span>
        </p>
      ) : null}
      {footer ? <div className="text-center text-small">{footer}</div> : null}
    </div>
  );
}

export { GateCard };
export type { GateCardProps };
