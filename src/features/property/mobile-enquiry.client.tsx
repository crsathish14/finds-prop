"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { EnquirySheet } from "@/components/domain/enquiry-sheet";
import { StickyMobileBar } from "@/components/domain/sticky-mobile-bar";
import type { EnquirySource } from "./property-enquiry";

type MobileEnquiryProps = EnquirySource & {
  rupees: number;
  listingType: "sale" | "rent";
  perSqftRupees?: number | undefined;
};

/**
 * What a phone has instead of the enquiry card (below 1024 px): the bar pinned to the bottom with the
 * price and the one copper button. A visitor who is not signed in gets a link to sign in; one who is
 * gets "Enquire", which opens the enquiry sheet (the bar is out of the way while it is open). Sending
 * is not open yet (S5-T03), so the sheet's Send is switched off with a line that says so.
 */
export function MobileEnquiry({
  signedIn,
  signInHref,
  createAccountHref,
  rupees,
  listingType,
  perSqftRupees,
}: MobileEnquiryProps) {
  const translate = useTranslations("property.page.enquiry");
  const [open, setOpen] = useState(false);
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
          open={open}
          onOpenChange={setOpen}
          state="form"
          signInHref={signInHref}
          createAccountHref={createAccountHref}
          sendDisabled
          sendNotice={translate("notOpen")}
        />
      ) : null}
    </>
  );
}
