"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { QueueAction } from "@/components/domain/listing-queue";
import {
  ReceivedEnquiriesList,
  ReceivedEnquiryRow,
} from "@/components/domain/received-enquiry-row";
import { Alert } from "@/components/patterns/alert";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import type { Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { movesFrom, type EnquiryMove } from "./received-rules";
import type { SetEnquiryStatusInput } from "./schemas";
import { formatSentAgo, type EnquiryStatus, type ReceivedEnquiry } from "./view";

export type ReceivedActions = {
  setStatus: (
    input: SetEnquiryStatusInput,
  ) => Promise<ActionResult<{ enquiryId: string; status: EnquiryStatus }>>;
};

type ReceivedBoardProps = {
  enquiries: ReceivedEnquiry[];
  /** The time of the read, in milliseconds, so "2 hours ago" is as of this request. */
  now: number;
  /** What shows when there is nothing to list (the page's empty state). */
  empty: ReactNode;
  actions: ReceivedActions;
};

/**
 * "Enquiries received" of the dashboard, below the tabs (S6-T03, FR-ACC-04): who asked about which of the owner's
 * homes, how to reach them (the phone and email are links), what they wrote, the state, and the buttons that move
 * it on (Mark contacted, Close enquiry). A move needs no confirmation: it only changes a label for the owner.
 * The answer is a toast, and the page is read again; until then the row shows the new state. A move that did not
 * happen says so in a line with Try again; an enquiry that already moved is said in a toast and the list is read
 * again.
 */
export function ReceivedBoard({ enquiries, now, empty, actions }: ReceivedBoardProps) {
  const translate = useTranslations("account.dashboard.received");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [changes, setChanges] = useState<Record<string, EnquiryStatus>>({});
  const [working, setWorking] = useState<{ id: string; move: EnquiryMove } | null>(null);
  const [failed, setFailed] = useState<{ id: string; move: EnquiryMove } | null>(null);

  const perform = async (enquiry: ReceivedEnquiry, move: EnquiryMove) => {
    setWorking({ id: enquiry.id, move });
    setFailed(null);
    const result = await actions.setStatus({ enquiryId: enquiry.id, status: move });
    setWorking(null);
    if (result.ok) {
      setChanges((previous) => ({ ...previous, [enquiry.id]: move }));
      notify.success(move === "contacted" ? translate("toastContacted") : translate("toastClosed"));
      router.refresh();
      return;
    }
    if (result.code === "CONFLICT" || result.code === "NOT_FOUND") {
      notify.error(translate("changed"));
      router.refresh();
      return;
    }
    setFailed({ id: enquiry.id, move });
  };

  const retry = () => {
    const again = failed ? enquiries.find((enquiry) => enquiry.id === failed.id) : undefined;
    if (failed && again) void perform(again, failed.move);
    else setFailed(null);
  };

  if (enquiries.length === 0) return <>{empty}</>;

  const actionsOf = (enquiry: ReceivedEnquiry, status: EnquiryStatus): QueueAction[] =>
    movesFrom(status).map((move) => ({
      id: move,
      label: move === "contacted" ? translate("contacted") : translate("closed"),
      forName: enquiry.name,
      tone: move === "contacted" ? "primary" : "secondary",
      onClick: () => void perform(enquiry, move),
      pending: working?.id === enquiry.id && working.move === move,
    }));

  const aboutOf = (enquiry: ReceivedEnquiry): ReactNode => {
    const title = enquiry.home?.title ?? null;
    const home = enquiry.home?.href ? (
      <Link href={enquiry.home.href}>{title}</Link>
    ) : (
      <span>{title ?? translate("homeGone")}</span>
    );
    return (
      <>
        {translate("about")} {home} · {formatSentAgo(everything, enquiry.receivedAt, now)}
      </>
    );
  };

  const failedEnquiry = failed ? enquiries.find((enquiry) => enquiry.id === failed.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {failed && failedEnquiry ? (
        <Alert
          tone="danger"
          title={translate("failedTitle")}
          action={
            <Button type="button" variant="danger-outline" size="sm" onClick={retry}>
              {translate("retry")}
            </Button>
          }
        >
          {translate("failedText")}
        </Alert>
      ) : null}
      <ReceivedEnquiriesList label={translate("listLabel")}>
        {enquiries.map((enquiry) => {
          const status = changes[enquiry.id] ?? enquiry.status;
          return (
            <ReceivedEnquiryRow
              key={enquiry.id}
              name={enquiry.name}
              phone={{ text: enquiry.phone, href: `tel:${enquiry.phone}` }}
              email={
                enquiry.email ? { text: enquiry.email, href: `mailto:${enquiry.email}` } : null
              }
              status={<StatusBadge kind="enquiry" status={status} />}
              about={aboutOf(enquiry)}
              message={enquiry.message}
              actions={actionsOf(enquiry, status)}
            />
          );
        })}
      </ReceivedEnquiriesList>
    </div>
  );
}
