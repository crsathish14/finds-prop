"use client";

/**
 * RejectListingDialog: the one dialog that confirms a rejection and asks why.
 * Purpose: "Reject this listing?" in the admin portal (S6-T04, FR-ADM-02). The reason is read by the owner,
 *   so it is asked in the same step as the confirmation, not after it. Owner: design system. It wraps Radix
 *   AlertDialog like `ConfirmDialog`, with a text box between the question and the buttons. It holds no
 *   state: the page keeps the open flag and the reason and passes the text, already translated.
 * Props: open and onOpenChange, title, description (what rejecting does), icon (an Icon element), reasonLabel,
 *   reasonHint, value and onValueChange (the reason), counter (such as "12 / 500"), error (a message
 *   under the box when the reason is missing or too long), confirmLabel, cancelLabel, onConfirm, loading.
 * Responsive: a centred card up to 480 px wide; on phones the buttons stack with the confirm button on top and
 *   Cancel first in the reading order.
 * Accessibility: role alertdialog named by the title and described by its text; focus goes to the reason box
 *   (the thing to do next), not to a button, and Escape cancels. The box has its label, its hint and its
 *   error tied to it, and an error is also marked with an icon and read aloud. While working, the buttons ignore
 *   clicks and the box stays as it is.
 * States: closed, open and empty, typed, error, working. Dependencies: radix AlertDialog, Button, FormField,
 *   Textarea. Tests: listing-queue.test.tsx; Design Lab "Admin" (S6-T04).
 * UX reference: admin-listings screen, state "confirm-reject" (dialog, icon-disc), with the reason box added
 *   by the owner's decision of 7 Nov 2026.
 */
import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type RejectListingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon?: ReactNode;
  reasonLabel: string;
  reasonHint?: string;
  value: string;
  onValueChange: (value: string) => void;
  counter: string;
  error?: string | undefined;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  loading?: boolean;
};

function RejectListingDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  reasonLabel,
  reasonHint,
  value,
  onValueChange,
  counter,
  error,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
}: RejectListingDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-dialog grid place-items-center overflow-y-auto bg-primary-deep/60 p-5">
          <AlertDialog.Content
            data-slot="reject-listing-dialog"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement | null)
                ?.querySelector<HTMLElement>("textarea")
                ?.focus();
            }}
            className="w-full max-w-120 rounded-xl bg-surface p-6 shadow-modal"
          >
            {icon ? (
              <div className="mb-4 grid size-12 place-items-center rounded-pill bg-danger-tint text-danger">
                {icon}
              </div>
            ) : null}
            <AlertDialog.Title className="text-h3 text-primary">{title}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-body text-muted">
              {description}
            </AlertDialog.Description>
            <div className="mt-4">
              <FormField
                label={reasonLabel}
                {...(reasonHint ? { hint: reasonHint } : {})}
                {...(error ? { error } : {})}
                required
              >
                <Textarea
                  value={value}
                  readOnly={loading}
                  counter={counter}
                  onChange={(event) => onValueChange(event.target.value)}
                />
              </FormField>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary" disabled={loading}>
                  {cancelLabel}
                </Button>
              </AlertDialog.Cancel>
              <Button variant="danger" loading={loading} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export { RejectListingDialog };
export type { RejectListingDialogProps };
