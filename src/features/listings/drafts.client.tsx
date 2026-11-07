"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DraftsList, type DraftItem } from "@/components/domain/drafts-list";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { notify } from "@/lib/notify";
import { isSessionEnded, sessionEndedHref } from "@/lib/session-ended";
import type { ActionResult } from "@/types/action";
import type { PropertyType } from "./constants";

/** One of the owner's drafts, with the words already chosen by the page (the date is formatted on the server). */
export type DraftRowView = {
  id: string;
  title: string | null;
  place: string | null;
  kind: "sale" | "rent" | null;
  propertyType: PropertyType | null;
  saved: string;
};

type YourDraftsProps = {
  drafts: DraftRowView[];
  /** `deleteListingDraft`, as the page hands it over. */
  remove: (input: { listingId: string }) => Promise<ActionResult<{ listingId: string }>>;
};

/**
 * "Your drafts" above a new listing (FR-ACC-08, S6-T02): each draft with Continue and Delete. Delete asks
 * first, and says it takes the photos too. A draft that is deleted leaves the list when the page asks the
 * server again; a refusal keeps the row and says so in a toast, because the person can try again.
 */
export function YourDrafts({ drafts, remove }: YourDraftsProps) {
  const words = useTranslations("postProperty.drafts");
  const types = useTranslations("postProperty.basics");
  const review = useTranslations("postProperty.review");
  const router = useRouter();
  const [asking, setAsking] = useState<DraftRowView | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const typeLabels = {
    apartment: types("typeApartment"),
    villa: types("typeVilla"),
    house: types("typeHouse"),
    plot: types("typePlot"),
    commercial: types("typeCommercial"),
  } as const;

  if (drafts.length === 0) return null;

  const items: DraftItem[] = drafts.map((draft) => {
    const title = draft.title ?? words("untitled");
    const type = draft.propertyType ? typeLabels[draft.propertyType] : "";
    const kind =
      draft.kind === "rent"
        ? review("forRent", { type })
        : draft.kind === "sale"
          ? review("forSale", { type })
          : type;
    return {
      id: draft.id,
      title,
      meta: [kind, draft.place].filter((part): part is string => Boolean(part)).join(" · "),
      updated: words("saved", { date: draft.saved }),
      continueHref: `/post-property/${draft.id}`,
      continueText: words("continue"),
      continueFor: title,
      deleteText: words("delete"),
      deleteFor: title,
      onDelete: () => setAsking(draft),
      pending: deleting === draft.id,
    };
  });

  function confirmDelete() {
    const draft = asking;
    if (!draft) return;
    setAsking(null);
    setDeleting(draft.id);
    startTransition(async () => {
      try {
        const result = await remove({ listingId: draft.id });
        if (result.ok) {
          notify.success(words("deleted"));
          router.refresh();
          return;
        }
        if (isSessionEnded(result)) {
          router.push(sessionEndedHref("/post-property"));
          return;
        }
        notify.error(words("deleteFailed"));
      } catch {
        notify.error(words("deleteFailed"));
      } finally {
        setDeleting(null);
      }
    });
  }

  return (
    <>
      <DraftsList heading={words("heading")} items={items} className="mb-8" />
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={words("deleteTitle")}
        description={words("deleteBody")}
        confirmLabel={words("deleteConfirm")}
        cancelLabel={words("deleteCancel")}
        onConfirm={confirmDelete}
      />
    </>
  );
}
