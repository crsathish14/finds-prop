import type { LabEntry } from "../types";
import {
  AmenityChipsDemo,
  ChoiceCardsDemo,
  DraftsListDemo,
  GateCardDemo,
  NextStepsDemo,
  ReviewListDemo,
  WizardFooterDemo,
  WizardShellDemo,
} from "./seller-demos";
import { ListingEditDemo } from "./seller-edit-demos";

/**
 * What an owner uses to post a property (S6-T02). The wizard's screens are made of these parts; the board
 * mirrors the post-property screen and its email gate (addendum ADD-03).
 */
export const SELLER: LabEntry[] = [
  {
    id: "wizard-shell",
    name: "Wizard shell",
    description:
      "The frame of the five-step wizard: the heading, the list of steps (a segmented bar with the step's name on phones), the card the step sits in, an alert at the top of the card and the footer. Step 1 clean and with errors, steps 2 and 4, the review when sending failed, and the phone versions in whole-page previews.",
    sources: ["domain/wizard-shell.tsx"],
    Demo: WizardShellDemo,
  },
  {
    id: "wizard-footer",
    name: "Wizard footer",
    description:
      "Back, Save draft and Continue or Submit for review. A row from 768 px; on phones a bar fixed to the bottom with Back and the main button. First step, a middle step, the last step, submitting and disabled.",
    sources: ["domain/wizard-footer.tsx"],
    Demo: WizardFooterDemo,
  },
  {
    id: "choice-cards",
    name: "Choice cards",
    description:
      "Choose one of a few options drawn as cards, such as Sell or Rent out: native radio buttons, a tick on the chosen card, and an error line. Nothing chosen, chosen and error.",
    sources: ["domain/choice-cards.tsx"],
    Demo: ChoiceCardsDemo,
  },
  {
    id: "amenity-chips",
    name: "Amenity chips",
    description:
      "A wrapping row of toggle chips for the twelve amenities: some chosen, none chosen and disabled.",
    sources: ["domain/amenity-chips.tsx"],
    Demo: AmenityChipsDemo,
  },
  {
    id: "review-list",
    name: "Review list",
    description:
      "One row per answer with an Edit button on the last step. Short answers, a very long address that wraps and an empty answer that shows a dash.",
    sources: ["domain/review-list.tsx"],
    Demo: ReviewListDemo,
  },
  {
    id: "next-steps",
    name: "Next steps",
    description:
      "The 'What happens next' box under the review: an icon, a title and a sentence. A short and a longer sentence.",
    sources: ["domain/next-steps.tsx"],
    Demo: NextStepsDemo,
  },
  {
    id: "gate-card",
    name: "Gate card",
    description:
      "The centred card that stands in for the wizard until the email is verified: the ask with its form, and the sent state read aloud as a status.",
    sources: ["domain/gate-card.tsx"],
    Demo: GateCardDemo,
  },
  {
    id: "listing-edit",
    name: "Edit a listing",
    description:
      "The wizard when the owner edits a listing that is already sent (S6-T05): a Live listing (with the line that says what sends it back to review, and Save changes), one in review, and one that was not approved (with the admin's reason and Resubmit for review). Save changes on a Live listing asks first when the change would send it back to review; try it.",
    sources: [
      "domain/wizard-shell.tsx",
      "domain/wizard-footer.tsx",
      "patterns/confirm-dialog.tsx",
      "patterns/alert.tsx",
    ],
    Demo: ListingEditDemo,
  },
  {
    id: "drafts-list",
    name: "Drafts list",
    description:
      "'Your drafts' above a new listing: each draft's title, place and when it was saved, with Continue and Delete. Two drafts, an untitled one, a very long title and a draft being deleted.",
    sources: ["domain/drafts-list.tsx"],
    Demo: DraftsListDemo,
  },
];
