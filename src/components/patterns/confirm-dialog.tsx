"use client";

/**
 * ConfirmDialog: asks the reader to confirm something before it happens (delete, mark as sold).
 * Purpose: wraps Radix AlertDialog, which traps focus and returns it afterwards. Owner: design system.
 * Props: open and onOpenChange (controlled: you close it, e.g. after an async action; leave both out
 *   to let the trigger open it and the buttons close it), tone ("danger" default | "warning" | "info"), icon (an Icon element),
 *   title (names the thing, e.g. "Delete this listing?"), description (the consequence),
 *   confirmLabel and cancelLabel (all already-translated), onConfirm, loading (while it works),
 *   trigger (optional element that opens it).
 * Responsive: a centred card up to 480 px wide; on phones the buttons stack with confirm on top;
 *   Cancel stays first in the reading order.
 * Accessibility: role alertdialog. For a danger or warning tone the Cancel button gets focus first,
 *   so Enter does not destroy anything by accident; for an info tone the confirm button does.
 *   Escape cancels. Focus returns to what opened it.
 * States: closed, open, working. Dependencies: radix AlertDialog, Button.
 * Tests: overlays.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, dialogs (c-core.css .dialog, .icon-disc).
 */
import { cva } from "class-variance-authority";
import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const discStyles = cva("mb-4 grid size-12 place-items-center rounded-pill", {
  variants: {
    tone: {
      danger: "bg-danger-tint text-danger",
      warning: "bg-warning-tint text-warning",
      info: "bg-info-tint text-info",
    },
  },
  defaultVariants: { tone: "danger" },
});

type ConfirmDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tone?: "danger" | "warning" | "info";
  icon?: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  trigger?: ReactNode;
};

function ConfirmDialog({
  open,
  onOpenChange,
  tone = "danger",
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  trigger,
}: ConfirmDialogProps) {
  const safeFirst = tone !== "info";
  const confirmButton = (
    <Button
      data-confirm=""
      variant={tone === "danger" ? "danger" : "primary"}
      loading={loading}
      onClick={onConfirm}
    >
      {confirmLabel}
    </Button>
  );
  return (
    <AlertDialog.Root {...(open === undefined ? {} : { open })} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-dialog grid place-items-center overflow-y-auto bg-primary-deep/60 p-5">
          <AlertDialog.Content
            data-slot="confirm-dialog"
            onOpenAutoFocus={(event) => {
              if (safeFirst) return;
              event.preventDefault();
              (event.currentTarget as HTMLElement | null)
                ?.querySelector<HTMLElement>("[data-confirm]")
                ?.focus();
            }}
            className="w-full max-w-120 rounded-xl bg-surface p-6 shadow-modal"
          >
            {icon ? <div className={discStyles({ tone })}>{icon}</div> : null}
            <AlertDialog.Title className="text-h3 text-primary">{title}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-body text-muted">
              {description}
            </AlertDialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </AlertDialog.Cancel>
              {open === undefined ? (
                <AlertDialog.Action asChild>{confirmButton}</AlertDialog.Action>
              ) : (
                confirmButton
              )}
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export { ConfirmDialog };
