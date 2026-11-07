import type { LabEntry } from "../types";
import { ListingQueueDemo, ListingReviewDemo, RejectDialogDemo } from "./admin-demos";

/**
 * What the admin uses to review the listings owners post (S6-T04). The board mirrors the admin listings
 * screen: the queue with its tabs and filters, the review drawer and the dialog that confirms a rejection.
 */
export const ADMIN: LabEntry[] = [
  {
    id: "listing-queue",
    name: "Listing queue",
    description:
      "The rows of the admin's listings page: a table from 1024 px of room and cards below that, each with the picture, title, owner, price, when it was submitted, its state and its buttons. Shown under the tabs and filters it sits in, with Show more, with featured, rejected (with its reason), sold, a very long title, a working button, and nothing to review.",
    sources: ["domain/listing-queue.tsx"],
    Demo: ListingQueueDemo,
  },
  {
    id: "listing-review",
    name: "Listing review",
    description:
      "The drawer where an admin reads one listing before deciding: every photo, the state, title, price and facts, the description, address and owner, and Approve and Reject fixed in the footer. A pending and a rejected listing, on a phone and on a desktop.",
    sources: ["domain/listing-review.tsx"],
    Demo: ListingReviewDemo,
  },
  {
    id: "reject-listing-dialog",
    name: "Reject listing dialog",
    description:
      "The one dialog that confirms a rejection and asks why, because the owner reads the reason. Empty, with an error, too long, and while rejecting; Cancel is read first and focus goes to the reason box.",
    sources: ["domain/reject-listing-dialog.tsx"],
    Demo: RejectDialogDemo,
  },
];
