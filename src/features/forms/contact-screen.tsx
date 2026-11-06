import { Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/** One line of "Reach us directly": what the content team set in the footer settings. */
export type ReachLine = { kind: "address" | "phone" | "email"; text: string; href?: string };

const REACH_ICONS: Record<ReachLine["kind"], LucideIcon> = {
  phone: Phone,
  email: Mail,
  address: MapPin,
};

type ContactScreenProps = {
  /** The form, or what stands in for it (the form that did not load). */
  children: ReactNode;
  /** The lines to show beside the form; with none the column is left out. */
  contacts: ReachLine[];
  /** Design Lab only: several screens on one board need their own heading level and id. */
  titleAs?: "h1" | "h2";
  titleId?: string;
};

function ReachCard({ contacts }: { contacts: ReachLine[] }) {
  const translate = useTranslations("contact.reach");
  const labels: Record<ReachLine["kind"], string> = {
    phone: translate("phone"),
    email: translate("email"),
    address: translate("address"),
  };
  return (
    <aside
      aria-label={translate("label")}
      className="h-fit rounded-xl border border-line bg-surface p-6 shadow-card"
    >
      <h2 className="mb-4 text-h3 text-primary">{translate("heading")}</h2>
      <ul className="flex flex-col gap-4">
        {contacts.map((line) => (
          <li key={line.kind} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-pill bg-primary-tint text-primary"
            >
              <Icon icon={REACH_ICONS[line.kind]} />
            </span>
            <div className="flex min-w-0 flex-col">
              <b className="text-small">{labels[line.kind]}</b>
              {line.href ? (
                <Link href={line.href} className="break-words">
                  {line.text}
                </Link>
              ) : (
                <span className="break-words text-muted">{line.text}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * The contact page below the header (S5-T05, P-07): the breadcrumb, "Talk to us", the form in a card and
 * "Reach us directly" beside it (below it on a phone). The form is whatever the page hands in, so the
 * Design Lab draws every state with sample content. With no contact details set, the column is left out and
 * the form takes a reading width.
 */
export function ContactScreen({
  children,
  contacts,
  titleAs = "h1",
  titleId = "contact-title",
}: ContactScreenProps) {
  const translate = useTranslations("contact");
  const beside = contacts.length > 0;
  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("crumb.nav")}
        backLabel={translate("crumb.backHome")}
        items={[{ label: translate("crumb.home"), href: "/" }, { label: translate("meta.title") }]}
      />
      <div className="mt-6 mb-6 flex flex-col gap-2">
        <Heading as={titleAs} size="1" id={titleId} tabIndex={-1}>
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("lead")}</Text>
      </div>
      <div className={cn("grid gap-6", beside ? "lg:grid-cols-3" : "max-w-3xl")}>
        <section
          aria-labelledby={titleId}
          className={cn(
            "min-w-0 rounded-xl border border-line bg-surface p-6 shadow-card",
            beside && "lg:col-span-2",
          )}
        >
          {children}
        </section>
        {beside ? <ReachCard contacts={contacts} /> : null}
      </div>
    </Container>
  );
}

/** The consent line under the contact form's button. */
export function ContactConsent() {
  const translate = useTranslations("contact.consent");
  return (
    <>
      {translate("text")} <Link href="/privacy">{translate("privacy")}</Link>
    </>
  );
}
