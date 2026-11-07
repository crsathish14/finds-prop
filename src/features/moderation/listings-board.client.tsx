"use client";

import { CircleX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListingQueue, type QueueAction, type QueueRow } from "@/components/domain/listing-queue";
import { ListingReview, ReviewFacts, type ReviewSpec } from "@/components/domain/listing-review";
import { RejectListingDialog } from "@/components/domain/reject-listing-dialog";
import { EmptyState } from "@/components/patterns/empty-state";
import { ShowMore } from "@/components/patterns/show-more";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { NativeSelect } from "@/components/ui/native-select";
import { PROPERTY_TYPES, PROPERTY_TYPE_WORDS, type PropertyType } from "@/config/search-options";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatArea, formatDate, formatPrice, formatRent, formatTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { QUEUE_TABS, REASON_MAX, type Decision, type QueueTab } from "./constants";
import { queueHref } from "./href";
import type { DecisionResult } from "./moderation-service";
import { afterDecision, decisionsFor, matchesTab, uniqueById } from "./rows";
import type { LoadMoreInput, ModerateListingInput, QueueFilters } from "./schemas";
import { countForTab, type QueueCounts, type QueueItem, type QueuePage } from "./view";

export type ListingsBoardActions = {
  moderate: (input: ModerateListingInput) => Promise<ActionResult<DecisionResult>>;
  loadMore: (input: LoadMoreInput) => Promise<ActionResult<QueuePage>>;
};

type ListingsBoardProps = {
  filters: QueueFilters;
  /** The first page of the queue for these filters. */
  items: QueueItem[];
  /** The cursor for "Show more", or null when the first page is the last. */
  nextCursor: string | null;
  counts: QueueCounts;
  localities: string[];
  actions: ListingsBoardActions;
};

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

/** Where each status of the database gets its word and colour (the same words as the owner sees). */
const STATUS_OF = {
  pending: "pendingReview",
  approved: "live",
  rejected: "notApproved",
  sold: "sold",
  rented: "rentedOut",
} as const;

function isPropertyType(value: string | null): value is PropertyType {
  return value !== null && (PROPERTY_TYPES as readonly string[]).includes(value);
}

/**
 * The admin's listings page below its heading (S6-T04, FR-ADM-02): the status tabs and the two filters (all in the
 * address), the queue, Show more, the review drawer and the dialog that asks why a listing is rejected. It calls
 * the two actions it is given and keeps nothing that the server does not also know: after a decision the page is
 * read again, and until then the decided row is shown as the decision left it (or leaves the tab it was on). The
 * rows loaded by Show more are kept here, because the server only re-reads the first page.
 */
export function ListingsBoard({
  filters,
  items,
  nextCursor,
  counts,
  localities,
  actions,
}: ListingsBoardProps) {
  const translate = useTranslations("admin.listings");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  const [more, setMore] = useState<QueueItem[]>([]);
  const [laterCursor, setLaterCursor] = useState<string | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [changes, setChanges] = useState<Record<string, Pick<QueueItem, "status" | "featured">>>(
    {},
  );
  const [working, setWorking] = useState<{ id: string; decision: Decision } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  // The page can be read again while rows from "Show more" are on screen, so a row is never drawn twice.
  const everyRow = uniqueById([...items, ...more]).map((item) => ({
    ...item,
    ...changes[item.id],
  }));
  const visible = everyRow.filter((item) => matchesTab(filters.tab, item.status));
  const cursor = loadedMore ? laterCursor : nextCursor;

  const navigate = (next: Partial<Pick<QueueFilters, "tab" | "locality" | "kind">>) => {
    const target = { tab: filters.tab, locality: filters.locality, kind: filters.kind, ...next };
    startNavigation(() => router.push(queueHref(target)));
  };

  const decisionToast = (decision: Decision) => {
    if (decision === "approve") {
      notify.success(translate("toast.approved.title"), {
        description: translate("toast.approved.text"),
      });
    } else if (decision === "reject") {
      notify.success(translate("toast.rejected.title"), {
        description: translate("toast.rejected.text"),
      });
    } else if (decision === "feature") {
      notify.success(translate("toast.featured.title"), {
        description: translate("toast.featured.text"),
      });
    } else {
      notify.success(translate("toast.unfeatured.title"), {
        description: translate("toast.unfeatured.text"),
      });
    }
  };

  /** Makes one decision. Returns what went wrong, or null when it worked. */
  const decide = async (
    item: QueueItem,
    decision: Decision,
    why?: string,
  ): Promise<Failure | null> => {
    setWorking({ id: item.id, decision });
    const result = await actions.moderate(
      decision === "reject"
        ? { decision, listingId: item.id, reason: why ?? "" }
        : { decision, listingId: item.id },
    );
    setWorking(null);
    if (result.ok) {
      setChanges((previous) => ({ ...previous, [item.id]: afterDecision(decision, item) }));
      decisionToast(decision);
      router.refresh();
      return null;
    }
    return result;
  };

  /** A failure with no field to blame: said in a toast, and the page is read again so it shows the truth. */
  const reportFailure = (failure: Failure) => {
    notify.error(
      failure.code === "CONFLICT" ? translate("conflict") : failureText(everything, failure),
    );
    router.refresh();
  };

  const act = async (item: QueueItem, decision: Decision) => {
    const failure = await decide(item, decision);
    if (failure) reportFailure(failure);
    else if (decision === "approve") setReviewId(null);
  };

  const openReject = (item: QueueItem) => {
    setReason("");
    setReasonError(undefined);
    setRejectId(item.id);
  };

  const confirmReject = async () => {
    const item = everyRow.find((candidate) => candidate.id === rejectId);
    if (!item) return;
    const trimmed = reason.trim();
    if (trimmed === "") {
      setReasonError(translate("reject.required"));
      return;
    }
    if (trimmed.length > REASON_MAX) {
      setReasonError(translate("reject.tooLong", { max: REASON_MAX }));
      return;
    }
    setReasonError(undefined);
    const failure = await decide(item, "reject", trimmed);
    if (!failure) {
      setRejectId(null);
      setReviewId(null);
      return;
    }
    const field = failure.fieldErrors?.["reason"]?.[0];
    if (field) setReasonError(fieldErrorText(everything, field));
    else reportFailure(failure);
  };

  const showMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const result = await actions.loadMore({
      tab: filters.tab,
      after: cursor,
      ...(filters.locality ? { locality: filters.locality } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
    });
    setLoadingMore(false);
    if (!result.ok) {
      notify.error(translate("showMore.failed"));
      return;
    }
    setMore((previous) => [...previous, ...result.data.items]);
    setLaterCursor(result.data.nextCursor);
    setLoadedMore(true);
  };

  const titleOf = (item: QueueItem) => item.title ?? translate("untitled");

  const submittedText = (item: QueueItem) =>
    translate("submitted", {
      date: formatDate(locale, item.submittedAt, "medium"),
      time: formatTime(locale, item.submittedAt),
    });

  const priceText = (item: QueueItem) => {
    if (item.price === null) return translate("notProvided");
    return item.listingType === "rent"
      ? formatRent(everything, locale, item.price)
      : formatPrice(everything, locale, item.price);
  };

  const kindWord = (item: QueueItem) => {
    if (item.listingType === "sale") return translate("filters.sale");
    if (item.listingType === "rent") return translate("filters.rent");
    return null;
  };

  const metaText = (item: QueueItem) =>
    [
      item.locality,
      isPropertyType(item.propertyType) ? everything(PROPERTY_TYPE_WORDS[item.propertyType]) : null,
      kindWord(item),
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · ");

  const statusBadges = (item: QueueItem) => (
    <>
      <StatusBadge kind="listing" status={STATUS_OF[item.status]} />
      {item.featured ? <Badge tone="featured">{translate("featured")}</Badge> : null}
    </>
  );

  const actionFor = (item: QueueItem, decision: Decision): QueueAction => {
    const base = {
      id: decision,
      forName: titleOf(item),
      onClick: () => (decision === "reject" ? openReject(item) : void act(item, decision)),
      pending: working?.id === item.id && working.decision === decision,
    };
    if (decision === "approve") {
      return { ...base, label: translate("actions.approve"), tone: "primary", icon: "check" };
    }
    if (decision === "reject") {
      return { ...base, label: translate("actions.reject"), tone: "danger-outline", icon: "cross" };
    }
    if (decision === "feature") {
      return { ...base, label: translate("actions.feature"), tone: "secondary", icon: "star" };
    }
    return { ...base, label: translate("actions.unfeature"), tone: "secondary" };
  };

  const reviewAction = (item: QueueItem): QueueAction => ({
    id: "review",
    label: translate("actions.review"),
    forName: titleOf(item),
    tone: "secondary",
    onClick: () => setReviewId(item.id),
  });

  const rowOf = (item: QueueItem): QueueRow => ({
    id: item.id,
    title: titleOf(item),
    meta: metaText(item),
    cover: item.photos[0] ? { src: item.photos[0].url, alt: "" } : null,
    ownerName: item.ownerName ?? translate("noOwnerName"),
    ownerEmail: item.ownerEmail,
    price: priceText(item),
    submitted: submittedText(item),
    status: statusBadges(item),
    ...(item.status === "rejected" && item.rejectionReason
      ? { note: translate("reason", { reason: item.rejectionReason }) }
      : {}),
    actions: [
      reviewAction(item),
      ...decisionsFor(item.status, item.featured).map((decision) => actionFor(item, decision)),
    ],
  });

  const furnishingWord = (value: string | null) => {
    if (value === "unfurnished") return translate("review.furnishing.unfurnished");
    if (value === "semi") return translate("review.furnishing.semi");
    if (value === "full") return translate("review.furnishing.full");
    return null;
  };

  const specsOf = (item: QueueItem): ReviewSpec[] => {
    const missing = translate("notProvided");
    const furnishing = furnishingWord(item.furnishing);
    const type = isPropertyType(item.propertyType)
      ? everything(PROPERTY_TYPE_WORDS[item.propertyType])
      : null;
    return [
      ...(item.bhk !== null
        ? [
            {
              id: "bedrooms",
              label: translate("review.specs.bedrooms"),
              value: translate("review.bedroomsValue", { count: item.bhk }),
            },
          ]
        : []),
      ...(item.bathrooms !== null
        ? [
            {
              id: "bathrooms",
              label: translate("review.specs.bathrooms"),
              value: String(item.bathrooms),
            },
          ]
        : []),
      {
        id: "area",
        label: translate("review.specs.area"),
        value: item.areaSqft !== null ? formatArea(everything, locale, item.areaSqft) : missing,
        ...(item.areaSqft === null ? { missing: true } : {}),
      },
      {
        id: "locality",
        label: translate("review.specs.locality"),
        value: item.locality ?? missing,
        ...(item.locality === null ? { missing: true } : {}),
      },
      {
        id: "furnishing",
        label: translate("review.specs.furnishing"),
        value: furnishing ?? missing,
        ...(furnishing === null ? { missing: true } : {}),
      },
      {
        id: "type",
        label: translate("review.specs.type"),
        value: type ?? missing,
        ...(type === null ? { missing: true } : {}),
      },
    ];
  };

  const reviewItem = everyRow.find((candidate) => candidate.id === reviewId) ?? null;
  const rejectItem = everyRow.find((candidate) => candidate.id === rejectId) ?? null;
  const filtered = Boolean(filters.locality ?? filters.kind);
  const total = countForTab(counts, filters.tab);

  const emptyWords = () => {
    if (filtered)
      return { title: translate("empty.filtered.title"), text: translate("empty.filtered.text") };
    if (filters.tab === "pending")
      return { title: translate("empty.pending.title"), text: translate("empty.pending.text") };
    if (filters.tab === "approved")
      return { title: translate("empty.approved.title"), text: translate("empty.approved.text") };
    if (filters.tab === "rejected")
      return { title: translate("empty.rejected.title"), text: translate("empty.rejected.text") };
    if (filters.tab === "closed")
      return { title: translate("empty.closed.title"), text: translate("empty.closed.text") };
    return { title: translate("empty.all.title"), text: translate("empty.all.text") };
  };

  const tabWord = (tab: QueueTab) => {
    if (tab === "pending") return translate("tabs.pending");
    if (tab === "approved") return translate("tabs.approved");
    if (tab === "rejected") return translate("tabs.rejected");
    if (tab === "closed") return translate("tabs.closed");
    return translate("tabs.all");
  };

  return (
    <>
      <Tabs
        value={filters.tab}
        onValueChange={(value) => {
          const next = QUEUE_TABS.find((tab) => tab === value);
          if (next) navigate({ tab: next });
        }}
      >
        <TabsList aria-label={translate("tabsLabel")}>
          {QUEUE_TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              count={countForTab(counts, tab)}
              {...(tab === "pending" && counts.pending > 0 ? { countTone: "new" as const } : {})}
            >
              {tabWord(tab)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex flex-col gap-3 py-4 md:flex-row">
          <div className="md:w-60">
            <NativeSelect
              aria-label={translate("filters.localityLabel")}
              value={filters.locality ?? ""}
              onChange={(event) => navigate({ locality: event.target.value || undefined })}
            >
              <option value="">{translate("filters.allLocalities")}</option>
              {localities.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="md:w-60">
            <NativeSelect
              aria-label={translate("filters.kindLabel")}
              value={filters.kind ?? ""}
              onChange={(event) => {
                const picked = event.target.value;
                navigate({ kind: picked === "sale" || picked === "rent" ? picked : undefined });
              }}
            >
              <option value="">{translate("filters.allKinds")}</option>
              <option value="sale">{translate("filters.sale")}</option>
              <option value="rent">{translate("filters.rent")}</option>
            </NativeSelect>
          </div>
        </div>
        <TabsContent
          value={filters.tab}
          aria-busy={navigating}
          className="flex flex-col gap-4 pt-0"
        >
          {visible.length === 0 ? (
            <EmptyState title={emptyWords().title} description={emptyWords().text} />
          ) : (
            <ListingQueue
              caption={translate("table.caption")}
              columns={{
                listing: translate("table.listing"),
                owner: translate("table.owner"),
                price: translate("table.price"),
                submitted: translate("table.submitted"),
                status: translate("table.status"),
                actions: translate("table.actions"),
              }}
              rows={visible.map(rowOf)}
            />
          )}
          {cursor ? (
            <ShowMore
              shown={visible.length}
              total={filtered ? visible.length + 1 : Math.max(total, visible.length + 1)}
              progressLabel={
                filtered
                  ? translate("showMore.progressFiltered", { shown: visible.length })
                  : translate("showMore.progress", { shown: visible.length, total })
              }
              buttonLabel={translate("showMore.button")}
              onShowMore={() => void showMore()}
              loading={loadingMore}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      {reviewItem ? (
        <ListingReview
          open
          onOpenChange={(open) => {
            if (!open) setReviewId(null);
          }}
          title={translate("review.title")}
          closeLabel={translate("review.close")}
          photosHeading={translate("review.photos", { count: reviewItem.photos.length })}
          photos={reviewItem.photos.map((photo, index) => ({
            src: photo.url,
            alt: translate("review.photoAlt", {
              number: index + 1,
              count: reviewItem.photos.length,
            }),
          }))}
          noPhotosText={translate("review.noPhotos")}
          badges={
            <>
              {kindWord(reviewItem) ? <Badge tone="outline">{kindWord(reviewItem)}</Badge> : null}
              {statusBadges(reviewItem)}
            </>
          }
          heading={titleOf(reviewItem)}
          price={priceText(reviewItem)}
          specs={specsOf(reviewItem)}
          sections={[
            ...(reviewItem.status === "rejected" && reviewItem.rejectionReason
              ? [
                  {
                    id: "reason",
                    heading: translate("review.sections.reason"),
                    body: reviewItem.rejectionReason,
                  },
                ]
              : []),
            ...(reviewItem.description
              ? [
                  {
                    id: "description",
                    heading: translate("review.sections.description"),
                    body: reviewItem.description,
                  },
                ]
              : []),
            {
              id: "address",
              heading: translate("review.sections.address"),
              body:
                [reviewItem.address, reviewItem.locality, reviewItem.city, reviewItem.pincode]
                  .filter((part): part is string => Boolean(part))
                  .join(", ") || translate("notProvided"),
            },
            {
              id: "owner",
              heading: translate("review.sections.owner"),
              body: (
                <ReviewFacts
                  rows={[
                    {
                      id: "name",
                      name: translate("review.owner.name"),
                      value: reviewItem.ownerName ?? translate("noOwnerName"),
                    },
                    {
                      id: "email",
                      name: translate("review.owner.email"),
                      value: reviewItem.ownerEmail ?? translate("notProvided"),
                    },
                    {
                      id: "posted",
                      name: translate("review.owner.posted"),
                      value: submittedText(reviewItem),
                    },
                  ]}
                />
              ),
            },
          ]}
          actions={decisionsFor(reviewItem.status, reviewItem.featured).map((decision) =>
            actionFor(reviewItem, decision),
          )}
        />
      ) : null}

      <RejectListingDialog
        open={rejectItem !== null}
        onOpenChange={(open) => {
          if (!open && working === null) setRejectId(null);
        }}
        title={translate("reject.title")}
        description={translate("reject.description", {
          title: rejectItem ? titleOf(rejectItem) : "",
        })}
        icon={<Icon icon={CircleX} size="lg" />}
        reasonLabel={translate("reject.reasonLabel")}
        reasonHint={translate("reject.reasonHint")}
        value={reason}
        onValueChange={(value) => {
          setReason(value);
          setReasonError(undefined);
        }}
        counter={translate("reject.counter", { count: reason.trim().length, max: REASON_MAX })}
        error={reasonError}
        confirmLabel={translate("reject.confirm")}
        cancelLabel={translate("reject.cancel")}
        onConfirm={() => void confirmReject()}
        loading={working?.decision === "reject"}
      />
    </>
  );
}
