"use client";

/**
 * EnquirySheet: the enquiry form in a bottom sheet, for a phone.
 * Purpose: opened by the sticky bar's "Enquire" button, so a visitor on a phone can write an enquiry
 *   without leaving the photos. Owner: design system. It is the shared Sheet around the sheet variant
 *   of EnquiryCard; it sends nothing (the enquiry action is Stage 5).
 * Props: open and onOpenChange (the page owns whether it is open, since the bar and the page both react
 *   to it), trigger (an element that opens it, used with asChild; leave it out when the page opens
 *   the sheet itself), and every EnquiryCard prop except variant, headingAs and className: state
 *   ("form" or "sent" here), values, errors, failed, submitting, onSubmit, signInHref,
 *   createAccountHref, enquiriesHref.
 * Responsive: a bottom sheet up to 90% of the screen's height with a grabber, as the shared Sheet is.
 *   Meant for phones; the page does not open it from 1024 px up, where the card sits beside the details.
 * Accessibility: a dialog named "Send an enquiry"; focus moves in, is trapped and returns to what opened
 *   it; Escape and the close button close it (all from Sheet). The form is the card’s, with its labels
 *   and errors.
 * States: closed, open with the form, open with errors, send failed, sending, sent.
 * Dependencies: Sheet, EnquiryCard, next-intl.
 * Tests: enquiry-card.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: property screen, mobile enquiry sheet (the "sheet" state). The shared Sheet draws a rule
 *   under its title row; the UX has none.
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/patterns/sheet";
import { EnquiryCard, type EnquiryCardProps } from "./enquiry-card";

type EnquirySheetProps = Omit<EnquiryCardProps, "variant" | "headingAs" | "className"> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

function EnquirySheet({ open, onOpenChange, trigger, ...card }: EnquirySheetProps) {
  const translate = useTranslations("domain.enquiry");
  return (
    <Sheet
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent title={translate("form.title")} closeLabel={translate("close")}>
        <EnquiryCard {...card} variant="sheet" />
      </SheetContent>
    </Sheet>
  );
}

export { EnquirySheet };
