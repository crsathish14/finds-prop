import type { ReactNode } from "react";
import { LocationPrompt } from "@/components/domain/location-prompt";
import { getSessionView } from "@/server/auth/get-session-view";
import { closeListing, deleteListing } from "./actions";
import { MyListingsBoard } from "./my-listings.client";
import { editHref } from "./my-listings-rules";
import { getListingsWithoutLocation, getMyListings } from "./queries";

/**
 * The My listings tab of the dashboard (S6-T03, FR-ACC-09): the owner's listings outside the drafts, newest first,
 * each with its state and the buttons for it. With none, the tab shows its empty state (the fallback the page
 * gives). It renders at request time, so "posted 2 days ago" is as of now. A failed read throws, so the account's
 * error page shows it.
 *
 * Above the list, one note while any listing in review or Live has no location (plan PR 7c, ADR-141 addendum): it
 * counts them and leads to the edit page of the newest one, and says so when one of them is Live because adding a
 * place sends it back to review. It goes away by itself once every listing holds a place; nothing is stored about
 * it being shown.
 */
export async function MyListingsTab({ fallback }: { fallback: ReactNode }) {
  const session = await getSessionView();
  if (!session) return fallback;
  const [{ listings, now }, unlocated] = await Promise.all([
    getMyListings(),
    getListingsWithoutLocation(),
  ]);
  if (listings.length === 0) return fallback;
  return (
    <div className="flex flex-col gap-6">
      {unlocated.count > 0 && unlocated.firstId ? (
        <LocationPrompt
          count={unlocated.count}
          href={editHref(unlocated.firstId)}
          sendsBackToReview={unlocated.anyLive}
        />
      ) : null}
      <MyListingsBoard
        listings={listings}
        now={now}
        empty={fallback}
        actions={{ close: closeListing, remove: deleteListing }}
      />
    </div>
  );
}
