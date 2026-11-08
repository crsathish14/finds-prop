import type { LabEntry } from "../types";
import { BuilderFormDemo, BuilderTableDemo, SignInAddressDemo } from "./admin-builders-demos";
import { ListingQueueDemo, ListingReviewDemo, RejectDialogDemo } from "./admin-demos";

/**
 * What the admin uses to review the listings owners post (S6-T04) and to invite and manage builders (S7-T05).
 * The board mirrors the admin listings screen (the queue with its tabs and filters, the review drawer and the
 * dialog that confirms a rejection) and the admin builders screen (the table, the invite and edit forms and the
 * address passed on after inviting).
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
  {
    id: "builder-table",
    name: "Builder table",
    description:
      "The rows of the admin's Builders page: a table from 1024 px of room and cards below that, each with the company and its login email, the state (Active, Invited, Inactive), projects, leads, the last sign-in and its buttons, the Edit button and a menu (Edit details, Resend invitation for an invited builder, Deactivate or Activate). Shown with the page heading and New builder, an agent, a builder who has not signed in, a very long name and email, nothing yet, and the confirmation before deactivating.",
    sources: [
      "domain/builder-table.tsx",
      "patterns/dropdown-menu.tsx",
      "patterns/confirm-dialog.tsx",
    ],
    Demo: BuilderTableDemo,
  },
  {
    id: "builder-form",
    name: "Builder form",
    description:
      "The fields of the New builder and Edit details drawers: company, login email, type (builder or agent), contact person, phone, logo link, website and about. Empty, with an email that cannot be used, in edit mode (the login email cannot be changed) and while sending; the drawer opens from its button and, after Invite builder, shows the address to pass on.",
    sources: ["domain/builder-form.tsx", "patterns/sheet.tsx"],
    Demo: BuilderFormDemo,
  },
  {
    id: "sign-in-address",
    name: "Sign-in address",
    description:
      "The address an invited builder signs in at, with a Copy address button that says Copied for a few seconds. Nothing is emailed in v1, so the admin passes this on. A normal address and a very long one on a narrow card.",
    sources: ["domain/sign-in-address.tsx"],
    Demo: SignInAddressDemo,
  },
];
