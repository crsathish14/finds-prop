import type { ReactNode } from "react";
import { getSessionView } from "@/server/auth/get-session-view";
import { closeListing, deleteListing } from "./actions";
import { MyListingsBoard } from "./my-listings.client";
import { getMyListings } from "./queries";

/**
 * The My listings tab of the dashboard (S6-T03, FR-ACC-09): the owner's listings outside the drafts, newest first,
 * each with its state and the buttons for it. With none, the tab shows its empty state (the fallback the page
 * gives). It renders at request time, so "posted 2 days ago" is as of now. A failed read throws, so the account's
 * error page shows it.
 */
export async function MyListingsTab({ fallback }: { fallback: ReactNode }) {
  const session = await getSessionView();
  if (!session) return fallback;
  const { listings, now } = await getMyListings();
  if (listings.length === 0) return fallback;
  return (
    <MyListingsBoard
      listings={listings}
      now={now}
      empty={fallback}
      actions={{ close: closeListing, remove: deleteListing }}
    />
  );
}
