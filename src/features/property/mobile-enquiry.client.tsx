"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { EnquirySheet } from "@/components/domain/enquiry-sheet";
import { StickyMobileBar } from "@/components/domain/sticky-mobile-bar";
import type { EnquirySource } from "./property-enquiry";
import { useEnquiryForm } from "./use-enquiry-form.client";

type MobileEnquiryProps = EnquirySource & {
  rupees: number;
  listingType: "sale" | "rent";
  perSqftRupees?: number | undefined;
};

/**
 * What a phone has instead of the enquiry card (below 1024 px): the bar pinned to the bottom with the
 * price and the one copper button. A visitor who is not signed in gets a link to sign in; one who is
 * gets "Enquire", which opens the enquiry sheet (the bar is out of the way while it is open). The sheet
 * is the same form as the card, connected to the enquiry action (S5-T03).
 */
export function MobileEnquiry({
  signedIn,
  signInHref,
  createAccountHref,
  connection,
  rupees,
  listingType,
  perSqftRupees,
}: MobileEnquiryProps) {
  const translate = useTranslations("property.page.enquiry");
  const { card, formKey } = useEnquiryForm(connection);
  // Until the visitor opens or closes the sheet it follows the page: coming back from signing in again
  // with kept answers, it is open with them already in it.
  const [chosen, setOpen] = useState<boolean | null>(null);
  const open = chosen ?? formKey === "restored";
  return (
    <>
      <StickyMobileBar
        rupees={rupees}
        listingType={listingType}
        {...(perSqftRupees === undefined ? {} : { perSqftRupees })}
        action={
          signedIn
            ? { label: translate("enquire"), onClick: () => setOpen(true) }
            : { label: translate("signInToEnquire"), href: signInHref }
        }
        {...(open ? { className: "hidden" } : {})}
      />
      {signedIn ? (
        <EnquirySheet
          key={formKey}
          open={open}
          onOpenChange={setOpen}
          signInHref={signInHref}
          createAccountHref={createAccountHref}
          {...card}
        />
      ) : null}
    </>
  );
}
