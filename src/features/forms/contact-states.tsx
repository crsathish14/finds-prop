import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";

/**
 * What takes the form's place on the contact page (S5-T05): the confirmation once a message is sent, and
 * the notice when the form could not be loaded. Both are plain screens with nothing to fetch, so the Design
 * Lab draws them as they are.
 */

type ContactSentProps = {
  /** The form's own success text, when its definition gives one; otherwise the standard words. */
  message?: string | null | undefined;
  headingAs?: "h2" | "h3";
};

export function ContactSent({ message, headingAs: Heading = "h2" }: ContactSentProps) {
  const translate = useTranslations("contact.sent");
  return (
    <div role="status" className="flex flex-col items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-pill bg-success-tint text-success"
      >
        <Icon icon={CircleCheck} size="lg" />
      </span>
      <Heading className="text-h2 text-primary">{translate("title")}</Heading>
      <p className="text-muted">{message ?? translate("body")}</p>
      <Button asChild variant="secondary">
        <Link href="/" className="text-primary no-underline hover:text-primary">
          {translate("backHome")}
        </Link>
      </Button>
    </div>
  );
}

type ContactLoadFailedProps = {
  /** The Refresh button (the page gives the one that reloads it). */
  action: ReactNode;
  /** True when contact details are shown beside the form, so the words may point to them. */
  hasContacts: boolean;
};

export function ContactLoadFailed({ action, hasContacts }: ContactLoadFailedProps) {
  const translate = useTranslations("contact.loadFailed");
  const body = hasContacts ? translate("body") : translate("bodyAlone");
  return (
    <Alert tone="danger" title={translate("title")} action={action}>
      {body}
    </Alert>
  );
}
