"use client";

/**
 * SessionEndedAlert: the warning a form shows when the visitor's session ended before they could send it
 * (S5-T07).
 * Purpose: says the session has ended, that what was typed is kept, and offers "Sign in again". Owner:
 *   design system. It is the screen only: the form decides when to show it and what pressing the link
 *   keeps (the typed answers), and gives the address to sign in at.
 * Props: href (where "Sign in again" leads; sign-in, asking to come back to this page), onSignIn (called
 *   when the link is pressed, before the browser leaves: the form keeps the typed answers here), className.
 * Responsive: full width of its form; the link wraps under the text on a narrow screen.
 * Accessibility: a polite status message (the warning tone) with an icon; the link is a real link.
 * States: one. Dependencies: Alert, Button, Link, next-intl.
 * Tests: session-ended-alert.test.tsx; Design Lab "Discovery" (S5-T07).
 * UX reference: none yet; built from the warning alert, as the "limit reached" notices are.
 */
import { useTranslations } from "next-intl";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

type SessionEndedAlertProps = {
  href: string;
  onSignIn?: () => void;
  className?: string;
};

function SessionEndedAlert({ href, onSignIn, className }: SessionEndedAlertProps) {
  const translate = useTranslations("domain.sessionEnded");
  return (
    <Alert
      tone="warning"
      title={translate("title")}
      {...(className ? { className } : {})}
      action={
        <Button asChild variant="secondary" size="sm">
          <Link
            href={href}
            {...(onSignIn ? { onClick: onSignIn } : {})}
            className="text-primary no-underline hover:text-primary"
          >
            {translate("action")}
          </Link>
        </Button>
      }
    >
      {translate("body")}
    </Alert>
  );
}

export { SessionEndedAlert };
export type { SessionEndedAlertProps };
