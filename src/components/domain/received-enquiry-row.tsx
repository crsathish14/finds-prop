/**
 * ReceivedEnquiryRow: one enquiry about the owner's listing, with the sender's details and the buttons that move
 * it forward.
 * Purpose: a line of "Enquiries received" on the dashboard (S6-T03, FR-ACC-04): who asked, how to reach them
 *   (a phone link, and an email link when they gave one), the state as a badge, which home it is about and when,
 *   what they wrote, and the buttons for that state (Mark contacted, Close enquiry; none once Closed). Owner:
 *   design system. It holds no state: the page passes the text, already translated, and what each button does.
 *   `ReceivedEnquiriesList` is the list around the rows.
 * Props: name, phone ({ text, href }, such as "98410 55512" and "tel:9841055512"), email ({ text, href } or
 *   nothing), status (a StatusBadge), about (what the enquiry is about and when, as an element: the home's title
 *   as a link while it is Live, then "· 2 hours ago"), message (what they wrote, or nothing), actions (the same
 *   buttons as the admin's rows: { id, label, forName, tone, onClick, pending }; `forName` is the sender's name,
 *   heard after the visible word), className. ReceivedEnquiriesList: label (names the list), children (the rows).
 * Responsive: one column at every width; the name and the state on one line, the contact links wrap under the
 *   name, the message keeps its line breaks and wraps, the buttons wrap.
 * Accessibility: a list item; the phone and email are real links (`tel:` and `mailto:`) with their text visible;
 *   every button has a visible word followed by hidden text naming the sender; a button that is working keeps its
 *   label and place; the state is a word, never colour alone.
 * States: New, Contacted, Closed; with and without an email, a message or a home that can be linked; a long
 *   name, address or message; a button working. Dependencies: QueueActionButtons, Icon, Link, cn. Tests:
 *   my-listing-row.test.tsx; Design Lab "Discovery" (S6-T03).
 * UX reference: dashboard screen, received (erow, who, contact, re, quote, btns).
 */
import { Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { QueueActionButtons, type QueueAction } from "./listing-queue";

type ContactLink = { text: string; href: string };

type ReceivedEnquiryRowProps = {
  name: string;
  phone: ContactLink;
  email?: ContactLink | null;
  status: ReactNode;
  about: ReactNode;
  message?: string | null;
  actions: QueueAction[];
  className?: string;
};

function ReceivedEnquiryRow({
  name,
  phone,
  email,
  status,
  about,
  message,
  actions,
  className,
}: ReceivedEnquiryRowProps) {
  return (
    <li
      data-slot="received-enquiry-row"
      className={cn("flex flex-col gap-3 rounded-lg border border-line bg-surface p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <b className="text-ink [overflow-wrap:anywhere]">{name}</b>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-small">
            <Link href={phone.href} className="inline-flex items-center gap-2">
              <Icon icon={Phone} size="sm" />
              {phone.text}
            </Link>
            {email ? (
              <Link href={email.href} className="inline-flex items-center gap-2 break-all">
                <Icon icon={Mail} size="sm" />
                {email.text}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">{status}</div>
      </div>
      <p className="text-small text-muted">{about}</p>
      {message ? (
        <blockquote className="border-l-4 border-line-strong pl-4 text-body whitespace-pre-line text-ink [overflow-wrap:anywhere]">
          {message}
        </blockquote>
      ) : null}
      {actions.length > 0 ? <QueueActionButtons actions={actions} /> : null}
    </li>
  );
}

type ReceivedEnquiriesListProps = { label: string; children: ReactNode; className?: string };

function ReceivedEnquiriesList({ label, children, className }: ReceivedEnquiriesListProps) {
  return (
    <ul aria-label={label} className={cn("flex flex-col gap-3", className)}>
      {children}
    </ul>
  );
}

export { ReceivedEnquiriesList, ReceivedEnquiryRow };
export type { ContactLink, ReceivedEnquiriesListProps, ReceivedEnquiryRowProps };
