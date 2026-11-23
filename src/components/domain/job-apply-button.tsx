/**
 * JobApplyButton: how a visitor applies for a job.
 * Purpose: the one next step of a job page (ADR-143 D4): the platform stores no applications, so applying is an
 *   external link (opened in a new tab) or an email (opens the visitor's mail app with the subject filled in). When
 *   the job can no longer be applied for, the button is replaced by a note and a link back to the open jobs.
 *   Owner: design system. It holds no state.
 * Props: apply ({ kind: "link", url } | { kind: "email", address }), title (the job's title, for the email subject
 *   and the hidden part of the label), open (false when the job has closed: draws the closed note), openJobsHref
 *   (where "See open jobs" goes), className.
 * Responsive: a full-width button on a phone, its own width from 768 px.
 * Accessibility: a real link. The external link says it opens in a new tab and carries rel="noopener"; each label ends
 *   with hidden text naming the job. The closed note is plain text, not a disabled button.
 * States: link, email, closed. The one copper button of the page.
 * Dependencies: Button, Link, Icon, Text, next-intl. Tests: job-parts.test.tsx; Design Lab "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the job page, ADR-143 section 4).
 */
import { ExternalLink, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type JobApply = { kind: "link"; url: string } | { kind: "email"; address: string };

type JobApplyButtonProps = {
  apply: JobApply;
  title: string;
  open?: boolean;
  openJobsHref: string;
  className?: string;
};

/** The address that opens the visitor's mail app with a subject. */
function mailtoHref(address: string, subject: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

function JobApplyButton({
  apply,
  title,
  open = true,
  openJobsHref,
  className,
}: JobApplyButtonProps) {
  const translate = useTranslations();
  if (!open) {
    return (
      <div data-slot="job-apply-closed" className={cn("flex flex-col gap-2", className)}>
        <p className="text-title-sm font-semibold text-ink">{translate("careers.apply.closed")}</p>
        <Text tone="muted" variant="small">
          {translate("careers.apply.closedText")}
        </Text>
        <Link href={openJobsHref} variant="arrow">
          {translate("careers.apply.seeJobs")}
        </Link>
      </div>
    );
  }
  return (
    <div data-slot="job-apply" className={cn("flex flex-col gap-2", className)}>
      <Button asChild variant="accent" size="lg" className="w-full md:w-fit">
        {apply.kind === "link" ? (
          <Link
            href={apply.url}
            external
            newTabLabel={translate("common.opensInNewTab")}
            variant="nav"
            className="text-on-cta no-underline hover:text-on-cta"
          >
            <Icon icon={ExternalLink} size="sm" />
            {translate("careers.apply.button")} <VisuallyHidden>{title}</VisuallyHidden>
          </Link>
        ) : (
          <Link
            href={mailtoHref(apply.address, translate("careers.apply.emailSubject", { title }))}
            variant="nav"
            className="text-on-cta no-underline hover:text-on-cta"
          >
            <Icon icon={Mail} size="sm" />
            {translate("careers.apply.byEmail")} <VisuallyHidden>{title}</VisuallyHidden>
          </Link>
        )}
      </Button>
      <Text tone="muted" variant="small">
        {apply.kind === "link"
          ? translate("careers.apply.linkHint")
          : translate("careers.apply.emailHint", { address: apply.address })}
      </Text>
    </div>
  );
}

export { JobApplyButton };
export type { JobApply, JobApplyButtonProps };
