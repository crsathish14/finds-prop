"use client";

import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { WizardFooter } from "@/components/domain/wizard-footer";
import { WizardShell } from "@/components/domain/wizard-shell";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Specimen, Stage } from "../frame";
import { INLINE_FOOTER, INLINE_SHELL, ReviewStep, stepsAt } from "./seller-parts";

/**
 * The post-property wizard when an owner edits a listing that is already sent (S6-T05): the same parts as the new
 * listing, with the words of an edit. Plain English text; nothing here goes anywhere.
 */

const NOTHING = () => undefined;

type EditState = "approved" | "pending" | "rejected";

const WORDS: Record<
  EditState,
  {
    description: string;
    review: string;
    next: string;
    save: string;
    saving: string;
  }
> = {
  approved: {
    description:
      "Your listing is live. If you change its kind, type, title, description or address, it goes back to review and stays hidden until it is approved again.",
    review: "Review and save",
    next: "Your changes are saved to your live listing. Changes to the price, size, amenities and place show on Find Prop at once.",
    save: "Save changes",
    saving: "Saving changes",
  },
  pending: {
    description:
      "Your listing is waiting for review. Your changes are saved to the same listing, which stays in review.",
    review: "Review and save",
    next: "Your changes are saved to your listing. It is still waiting for review and stays hidden until it is approved.",
    save: "Save changes",
    saving: "Saving changes",
  },
  rejected: {
    description: "Fix what the reviewer asked for, then send your listing for review again.",
    review: "Review and resubmit",
    next: "When you resubmit, your listing goes back to review. It stays hidden until it is approved.",
    save: "Resubmit for review",
    saving: "Resubmitting",
  },
};

const NOTICES: Record<EditState, ReactNode> = {
  approved: (
    <Alert tone="info" title="You're editing a live listing">
      A change to the kind, type, title, description or address sends it back to review. Any other
      change shows on Find Prop at once.
    </Alert>
  ),
  pending: null,
  rejected: (
    <Alert tone="danger" title="This listing was not approved">
      Reason: Add a photo of the home itself, not of the street.
    </Alert>
  ),
};

function EditWizard({
  state,
  id,
  onSave = NOTHING,
  saving = false,
  alert,
}: {
  state: EditState;
  id: string;
  onSave?: () => void;
  saving?: boolean;
  alert?: ReactNode;
}) {
  const words = WORDS[state];
  const steps = stepsAt(5).map((step, index) =>
    index === 4 ? { ...step, label: words.review } : step,
  );
  const notice = alert ?? NOTICES[state];
  return (
    <WizardShell
      title="Edit your listing"
      emphasis="listing"
      titleAs="h2"
      titleId={id}
      description={words.description}
      steps={steps}
      progressLabel={`Step 5 of 5: ${words.review}`}
      className={INLINE_SHELL}
      {...(notice ? { alert: notice } : {})}
      footer={
        <WizardFooter
          className={INLINE_FOOTER}
          back={{ label: "Back", onClick: NOTHING }}
          next={{
            label: saving ? words.saving : words.save,
            onClick: onSave,
            kind: "submit",
            loading: saving,
          }}
        />
      }
    >
      <ReviewStep
        title={words.review}
        intro="Check your details. You can go back to change anything."
        nextTitle="What happens next"
        next={words.next}
      />
    </WizardShell>
  );
}

/** Save changes on a Live listing asks first, as it does when a moderated field was changed. */
function LiveWithQuestion() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EditWizard state="approved" id="listing-edit-live" onSave={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="warning"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title="Send this listing back to review?"
        description="Saving these changes sends your listing back to review. It stays hidden until it is approved again."
        confirmLabel="Save and send for review"
        cancelLabel="Keep editing"
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export function ListingEditDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="A Live listing, last step: the line that says what sends it back to review. Save changes opens the question (try it; Escape or Keep editing closes it)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full p-0">
          <LiveWithQuestion />
        </Stage>
      </Specimen>
      <Specimen
        label="A listing in review: its changes are saved to the same listing"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full p-0">
          <EditWizard state="pending" id="listing-edit-pending" />
        </Stage>
      </Specimen>
      <Specimen
        label="A listing that was not approved: the admin's reason, and Resubmit for review"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full p-0">
          <EditWizard state="rejected" id="listing-edit-rejected" />
        </Stage>
      </Specimen>
      <Specimen label="Saving: the label holds and clicks are ignored" className="w-full">
        <Stage tone="canvas" className="w-full p-0">
          <EditWizard state="rejected" id="listing-edit-saving" saving />
        </Stage>
      </Specimen>
    </div>
  );
}
