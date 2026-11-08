"use client";

/**
 * ManagerDrawer: the side drawer where a row of an admin or builder list is added or edited.
 * Purpose: one drawer for "Add unit", "Edit details" and the like (S7-T01): a title, a short line, the form, and
 *   a footer with Cancel and the main button that stays in view while the form scrolls. Owner: design system.
 *   It holds no form state: the page owns the values and the sending, and gives the form the same id as
 *   `formId`, so the footer button sends it.
 * Props: open and onOpenChange (the page decides when it is open), title and description (already-translated),
 *   closeLabel (the close button's name), cancelLabel, submitLabel and formId (leave both out for a drawer
 *   that only shows something: then one Close button is shown), pending (the main button is working: it keeps
 *   its label and its place, and does nothing a second time), children (the form).
 * Responsive: a full-height panel on the right, up to 540 px wide; on a phone it fills the screen.
 * Accessibility: a dialog named by its title; focus moves in, is trapped, and returns to the button that opened
 *   it; Escape and the close button close it. The footer button is tied to the form with the form attribute, so
 *   Enter in a box sends it too.
 * States: closed, open, sending. Dependencies: Sheet, Button. Tests: manager-drawer.test.tsx; Design Lab
 *   "Admin" (S7-T01).
 * UX reference: admin-units screen (drawer-side, header, body, footer).
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "./sheet";

type ManagerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  cancelLabel: string;
  submitLabel?: string;
  formId?: string;
  pending?: boolean;
  children: ReactNode;
};

function ManagerDrawer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  cancelLabel,
  submitLabel,
  formId,
  pending = false,
  children,
}: ManagerDrawerProps) {
  const sends = submitLabel !== undefined && formId !== undefined;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        title={title}
        closeLabel={closeLabel}
        {...(description ? { description } : {})}
        footer={
          <>
            <SheetClose asChild>
              <Button type="button" variant={sends ? "secondary" : "primary"}>
                {cancelLabel}
              </Button>
            </SheetClose>
            {sends ? (
              <Button type="submit" form={formId} variant="primary" loading={pending}>
                {submitLabel}
              </Button>
            ) : null}
          </>
        }
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

export { ManagerDrawer };
export type { ManagerDrawerProps };
