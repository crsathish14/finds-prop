/**
 * LocationPrompt: asks an owner to add a location to listings that have none.
 * Purpose: a home with no position is left out of searches by place, so My listings shows this note once for
 *   the listings that need a location (OLA_MAPS_PLAN.md D4, ADR-131). Owner: design system. A thin wrapper
 *   over Alert; it holds no state and the page decides when to draw it and where "Add location" leads.
 * Props: count (how many of the owner's listings have no location), href (where "Add location" goes: the
 *   edit page of the first such listing), sendsBackToReview (true when one of them is Live: adding a place sends
 *   it back to review, so the note says so before the owner starts), className.
 * Responsive: full width of its container; the action wraps under the text on a narrow screen (Alert).
 * Accessibility: a polite status (an info Alert), not an alert: it is a suggestion, not an error. The action
 *   is a link with a name that says what it does.
 * States: one listing, several listings, with and without the review note.
 * Dependencies: Alert, Link, next-intl. Tests: location-field.test.tsx; Design Lab "Location field"
 *   (ADR-131).
 * UX reference: none yet; drawn from an existing Alert for the owner's approval.
 */
import { useTranslations } from "next-intl";
import { Alert } from "@/components/patterns/alert";
import { Link } from "@/components/ui/link";

type LocationPromptProps = {
  count: number;
  href: string;
  sendsBackToReview?: boolean;
  className?: string;
};

function LocationPrompt({ count, href, sendsBackToReview, className }: LocationPromptProps) {
  const translate = useTranslations();
  return (
    <Alert
      tone="info"
      title={translate("domain.locationPrompt.title")}
      action={
        <Link href={href} variant="arrow">
          {translate("domain.locationPrompt.action")}
        </Link>
      }
      {...(className ? { className } : {})}
    >
      <span className="block">{translate("domain.locationPrompt.body", { count })}</span>
      {sendsBackToReview ? (
        <span className="mt-1 block">{translate("domain.locationPrompt.reviewNote")}</span>
      ) : null}
    </Alert>
  );
}

export { LocationPrompt };
export type { LocationPromptProps };
