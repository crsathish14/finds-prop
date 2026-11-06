import { useTranslations } from "next-intl";
import { Link } from "@/components/ui/link";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Text } from "@/components/ui/text";
import type { Translate } from "@/lib/format";
import { formatSentAgo, sentStatusOf, type SentEnquiry } from "./view";

type EnquiryListProps = {
  enquiries: readonly SentEnquiry[];
  /** The time the list is drawn at, in milliseconds; the page passes the request's time. */
  now: number;
};

/**
 * The visitor's sent enquiries as the dashboard's My enquiries tab draws them (FR-ACC-05): each with the
 * home it was about (a link, or "a home that is no longer listed"), how long ago it was sent, the reply
 * status (read-only: "Waiting for owner", "Contacted" or "Closed") and the message that was sent. It
 * fetches nothing, so the Design Lab draws it with sample rows.
 */
export function EnquiryList({ enquiries, now }: EnquiryListProps) {
  const translate = useTranslations();
  const words = useTranslations("enquiries.list");
  // The same cast the helpers' own tests use: next-intl's strict translator type is wider than Translate.
  const sayAgo = (sentAt: string) => formatSentAgo(translate as unknown as Translate, sentAt, now);
  return (
    <ul aria-label={words("listLabel")} className="flex flex-col gap-3">
      {enquiries.map((enquiry) => (
        <li
          key={enquiry.id}
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              {enquiry.home ? (
                <Link href={enquiry.home.href} className="font-bold">
                  {enquiry.home.title}
                </Link>
              ) : (
                <Text as="span" className="font-bold">
                  {words("homeGone")}
                </Text>
              )}
              <Text as="span" variant="caption" tone="muted">
                {words("sent", { when: sayAgo(enquiry.sentAt) })}
              </Text>
            </div>
            <StatusBadge kind="enquiry" status={sentStatusOf(enquiry.status)} />
          </div>
          {enquiry.message ? (
            <Text tone="muted" className="whitespace-pre-line">
              {enquiry.message}
            </Text>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
