"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { QueueAction } from "@/components/domain/listing-queue";
import { MyListingRow, MyListingsList } from "@/components/domain/my-listing-row";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Translator } from "@/i18n/failure-text";
import { formatListedAgo, formatPrice, formatRent } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import {
  ageInDays,
  editHref,
  outcomeFor,
  ownerActions,
  statusAfterClose,
} from "./my-listings-rules";
import type { ClosedListing } from "./my-listings-service";
import type { CloseListingInput, DeleteListingInput } from "./schemas";
import type { MyListing, MyListingStatus } from "./view";

export type MyListingsActions = {
  close: (input: CloseListingInput) => Promise<ActionResult<ClosedListing>>;
  remove: (input: DeleteListingInput) => Promise<ActionResult<{ listingId: string }>>;
};

type MyListingsBoardProps = {
  listings: MyListing[];
  /** The time of the read, in milliseconds, so "posted 2 days ago" is as of this request. */
  now: number;
  /** What shows when every listing has gone (the page's empty state). */
  empty: ReactNode;
  actions: MyListingsActions;
};

/** What the owner asked for: close as sold or rented, or delete. */
type Kind = "sold" | "rented" | "delete";

/** Where each state of a listing gets its word and colour (the same words as the admin sees). */
const BADGE_OF = {
  pending: "pendingReview",
  approved: "live",
  rejected: "notApproved",
  sold: "sold",
  rented: "rentedOut",
} as const satisfies Record<MyListingStatus, string>;

/** The public page of a listing, only while it is Live (no other state has an open page). */
function homeHref(listing: MyListing, status: MyListingStatus): string | null {
  return status === "approved" ? `/properties/${listing.slug}-${listing.shortId}` : null;
}

/**
 * "My listings" of the dashboard, below the tabs (S6-T03, FR-ACC-09 to FR-ACC-12): one row per listing with its
 * state and the buttons for that state. Marking a listing sold or rented, and deleting it, each ask first; the
 * answer is a toast, and the page is read again so it shows what the database holds. Until then the row is drawn
 * as the change left it. A change that did not happen says so in a line with Try again; a listing that changed
 * under the owner (closed already, or gone) is said in a toast and the list is read again.
 */
export function MyListingsBoard({ listings, now, empty, actions }: MyListingsBoardProps) {
  const translate = useTranslations("account.dashboard.listings");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [changes, setChanges] = useState<Record<string, MyListingStatus>>({});
  const [gone, setGone] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<{ id: string; kind: Kind } | null>(null);
  const [working, setWorking] = useState<{ id: string; kind: Kind } | null>(null);
  const [failed, setFailed] = useState<{ id: string; kind: Kind } | null>(null);

  const rows = listings
    .filter((listing) => !gone.includes(listing.id))
    .map((listing) => ({ listing, status: changes[listing.id] ?? listing.status }));

  const titleOf = (listing: MyListing) => listing.title ?? translate("untitled");

  const perform = async (listing: MyListing, kind: Kind) => {
    setWorking({ id: listing.id, kind });
    setFailed(null);
    const result =
      kind === "delete"
        ? await actions.remove({ listingId: listing.id })
        : await actions.close({ listingId: listing.id, outcome: kind });
    setWorking(null);
    setConfirming(null);
    if (result.ok) {
      if (kind === "delete") {
        setGone((previous) => [...previous, listing.id]);
        notify.success(translate("toastDeletedTitle"), {
          description: translate("toastDeletedText"),
        });
      } else {
        setChanges((previous) => ({ ...previous, [listing.id]: statusAfterClose(kind) }));
        notify.success(
          kind === "sold" ? translate("toastSoldTitle") : translate("toastRentedTitle"),
          { description: translate("toastClosedText") },
        );
      }
      router.refresh();
      return;
    }
    if (result.code === "CONFLICT" || result.code === "NOT_FOUND") {
      notify.error(translate("changed"));
      router.refresh();
      return;
    }
    setFailed({ id: listing.id, kind });
  };

  const retry = () => {
    const again = failed ? listings.find((listing) => listing.id === failed.id) : undefined;
    if (failed && again) void perform(again, failed.kind);
    else setFailed(null);
  };

  if (rows.length === 0) return <>{empty}</>;

  const priceOf = (listing: MyListing) => {
    if (listing.price === null) return translate("notProvided");
    return listing.listingType === "rent"
      ? formatRent(everything, locale, listing.price)
      : formatPrice(everything, locale, listing.price);
  };

  const postedOf = (listing: MyListing) => {
    const days = ageInDays(listing.createdAt, now);
    return days < 1
      ? translate("postedToday")
      : translate("posted", { when: formatListedAgo(everything, days) });
  };

  const actionsOf = (listing: MyListing, status: MyListingStatus): QueueAction[] => {
    const title = titleOf(listing);
    const outcome = outcomeFor(listing.listingType);
    const busy = (kind: Kind) => working?.id === listing.id && working.kind === kind;
    return ownerActions(status).flatMap((action): QueueAction[] => {
      if (action === "edit") {
        return [
          {
            id: "edit",
            label: translate("edit"),
            forName: title,
            tone: "secondary",
            onClick: () => router.push(editHref(listing.id)),
          },
        ];
      }
      if (action === "delete") {
        return [
          {
            id: "delete",
            label: translate("delete"),
            forName: title,
            tone: "danger-outline",
            onClick: () => setConfirming({ id: listing.id, kind: "delete" }),
            pending: busy("delete"),
          },
        ];
      }
      if (!outcome) return [];
      return [
        {
          id: "close",
          label: outcome === "sold" ? translate("sold") : translate("rented"),
          forName: title,
          tone: "secondary",
          icon: "check",
          onClick: () => setConfirming({ id: listing.id, kind: outcome }),
          pending: busy(outcome),
        },
      ];
    });
  };

  const noteOf = (listing: MyListing, status: MyListingStatus) => {
    if (status === "pending") return { tone: "waiting" as const, text: translate("waiting") };
    if (status === "rejected" && listing.rejectionReason) {
      return {
        tone: "rejected" as const,
        text: translate("reason", { reason: listing.rejectionReason }),
      };
    }
    return null;
  };

  const sure = confirming ? listings.find((listing) => listing.id === confirming.id) : undefined;
  const failedListing = failed ? listings.find((listing) => listing.id === failed.id) : undefined;
  const kind = confirming?.kind;
  const dialog =
    kind === "delete"
      ? {
          title: translate("confirmDeleteTitle"),
          text: translate("confirmDeleteText", { title: sure ? titleOf(sure) : "" }),
          confirm: translate("confirmDelete"),
          cancel: translate("cancel"),
        }
      : {
          title:
            kind === "rented" ? translate("confirmRentedTitle") : translate("confirmSoldTitle"),
          text: translate("confirmClosedText", { title: sure ? titleOf(sure) : "" }),
          confirm: kind === "rented" ? translate("rented") : translate("sold"),
          cancel: translate("keepLive"),
        };

  return (
    <div className="flex flex-col gap-4">
      {failed && failedListing ? (
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
      <MyListingsList label={translate("listLabel")} footnote={translate("footnote")}>
        {rows.map(({ listing, status }) => {
          const note = noteOf(listing, status);
          return (
            <MyListingRow
              key={listing.id}
              title={titleOf(listing)}
              href={homeHref(listing, status)}
              cover={listing.coverUrl ? { src: listing.coverUrl, alt: "" } : null}
              price={priceOf(listing)}
              place={listing.locality}
              posted={postedOf(listing)}
              kind={
                listing.listingType === "sale"
                  ? translate("sale")
                  : listing.listingType === "rent"
                    ? translate("rent")
                    : null
              }
              status={<StatusBadge kind="listing" status={BADGE_OF[status]} />}
              note={note}
              actions={actionsOf(listing, status)}
            />
          );
        })}
      </MyListingsList>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && working === null) setConfirming(null);
        }}
        tone={kind === "delete" ? "danger" : "warning"}
        icon={<Icon icon={kind === "delete" ? Trash2 : TriangleAlert} size="lg" />}
        title={dialog.title}
        description={dialog.text}
        confirmLabel={dialog.confirm}
        cancelLabel={dialog.cancel}
        loading={working !== null}
        onConfirm={() => {
          if (sure && kind) void perform(sure, kind);
        }}
      />
    </div>
  );
}
