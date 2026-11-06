import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { LEAD_CARD_FRAME } from "./lead-card-frame";

/**
 * The enquiry card when the project has an assigned form (S5-T05, change 4, BR-49): the same box as the
 * built-in card (the anchor `#enquiry` is this card, so the phone bar can lead to it), with the form
 * inside. It is the shell only; the form itself is the connected renderer the slot puts in, with
 * `ProjectFormTitle` above it until it is sent.
 */
export function ProjectFormCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id="enquiry" data-slot="project-form-card" className={cn(LEAD_CARD_FRAME, className)}>
      {children}
    </div>
  );
}

/** The card's heading, the same words as the built-in card. */
export function ProjectFormTitle() {
  const translate = useTranslations("projects.page.lead");
  return (
    <Heading as="h2" size="3" className="mb-4">
      {translate("title")}
    </Heading>
  );
}

/** What takes the form's place once it is sent: the form's own success text, else the card's standard words. */
export function ProjectFormSent({ message }: { message?: string | null | undefined }) {
  const translate = useTranslations("projects.page.lead.sent");
  return (
    <div role="status" className="flex flex-col items-start gap-3">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-pill bg-success-tint text-success"
      >
        <Icon icon={CircleCheck} size="lg" />
      </span>
      <Heading as="h3" size="3">
        {translate("title")}
      </Heading>
      <p className="text-small text-muted">{message ?? translate("body")}</p>
    </div>
  );
}

/** The consent line under the form's button: the same words as the built-in card, naming the developer. */
export function ProjectFormConsent({ developerName }: { developerName?: string | undefined }) {
  const translate = useTranslations("projects.page.lead");
  return (
    <>
      {translate("consent", { developer: developerName ?? translate("consentDeveloper") })}{" "}
      <Link href="/privacy">{translate("consentPrivacy")}</Link>
    </>
  );
}
