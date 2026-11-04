"use client";

import { useState } from "react";
import { EnquiryCard, type EnquiryValues } from "@/components/domain/enquiry-card";
import { EnquirySheet } from "@/components/domain/enquiry-sheet";
import { PriceCard } from "@/components/domain/price-card";
import { StickyMobileBar } from "@/components/domain/sticky-mobile-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

const BADGES = (
  <>
    <Badge tone="outline">For sale</Badge>
    <Badge tone="featured">Featured</Badge>
  </>
);

const FILLED: EnquiryValues = {
  name: "Priya Raman",
  phone: "98400 12345",
  email: "",
  message: "",
};

const COLUMN = "w-full max-w-sm";

export function PriceCardDemo() {
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-8">
      <Specimen label="Sale, with the price per square foot and the tags" className={COLUMN}>
        <PriceCard rupees={1_25_00_000} perSqftRupees={8_803} badges={BADGES} className="w-full" />
      </Specimen>
      <Specimen label="Sale, area not known: no price per square foot" className={COLUMN}>
        <PriceCard rupees={78_00_000} badges={BADGES} className="w-full" />
      </Specimen>
      <Specimen label="Rent" className={COLUMN}>
        <PriceCard
          rupees={48_000}
          listingType="rent"
          badges={<Badge tone="outline">For rent</Badge>}
          className="w-full"
        />
      </Specimen>
      <Specimen label="No tags" className={COLUMN}>
        <PriceCard rupees={62_00_000} perSqftRupees={5_900} className="w-full" />
      </Specimen>
    </div>
  );
}

export function EnquiryCardDemo() {
  const [sent, setSent] = useState<EnquiryValues | null>(null);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-8">
        <Specimen label="Signed out: the visitor is asked to sign in" className={COLUMN}>
          <EnquiryCard
            state="signed_out"
            headingAs="h3"
            signInHref="#sign-in"
            createAccountHref="#create-account"
            className="w-full"
          />
        </Specimen>
        <Specimen
          label="Signed in: the form, empty (type to see the message counter)"
          className={COLUMN}
        >
          <EnquiryCard state="form" headingAs="h3" onSubmit={setSent} className="w-full" />
        </Specimen>
        <Specimen label="The form with the name and phone filled in" className={COLUMN}>
          <EnquiryCard state="form" headingAs="h3" values={FILLED} className="w-full" />
        </Specimen>
        <Specimen label="Errors: the name and the phone need attention" className={COLUMN}>
          <EnquiryCard
            state="form"
            headingAs="h3"
            values={{ name: "A", phone: "12345" }}
            errors={{
              name: "Enter your name (2 to 80 characters).",
              phone: "Enter a phone number with 6 to 15 digits.",
            }}
            className="w-full"
          />
        </Specimen>
        <Specimen label="Send failed: what was typed is still there" className={COLUMN}>
          <EnquiryCard
            state="form"
            headingAs="h3"
            failed
            values={{ ...FILLED, message: "Is the flat still available? I can visit on Saturday." }}
            className="w-full"
          />
        </Specimen>
        <Specimen
          label="Sending: the button shows it is working and ignores clicks"
          className={COLUMN}
        >
          <EnquiryCard state="form" headingAs="h3" submitting values={FILLED} className="w-full" />
        </Specimen>
        <Specimen label="Sent" className={COLUMN}>
          <EnquiryCard
            state="sent"
            headingAs="h3"
            enquiriesHref="#my-enquiries"
            className="w-full"
          />
        </Specimen>
        <Specimen label="Long text: the fields hold it, the card grows" className={COLUMN}>
          <EnquiryCard
            state="form"
            headingAs="h3"
            values={{
              name: "Venkatasubramanian Ramanathan Iyer",
              phone: "984001234567890",
              email: "venkatasubramanian.ramanathan.iyer@example-company-name.example.com",
              message:
                "I am looking for a three bedroom home close to the metro for my parents, who will move in next month. Could you tell me about the maintenance charges and whether the society allows pets?",
            }}
            className="w-full"
          />
        </Specimen>
      </div>
      <Text tone="muted">
        {sent
          ? `Send pressed with: ${JSON.stringify(sent)}`
          : "Press Send enquiry on the empty form to see the values it hands to the page."}{" "}
        The card sends nothing: the enquiry action is Stage 5. Errors that arrive after the form is
        shown move focus to the first field with one; the errors drawn here were there from the
        start, so they do not.
      </Text>
    </div>
  );
}

export function EnquirySheetDemo() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"form" | "sent">("form");
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Press Enquire to open the real sheet (it opens over the page)">
        <EnquirySheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setState("form");
          }}
          state={state}
          values={FILLED}
          onSubmit={() => setState("sent")}
          enquiriesHref="#my-enquiries"
          trigger={<Button variant="accent">Enquire</Button>}
        />
      </Specimen>
      <Specimen label="The open sheet, drawn here so it can be compared (the real one opens over the page)">
        <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-modal">
          <span
            aria-hidden="true"
            className="mx-auto mt-3 h-1.5 w-11 rounded-pill bg-line-strong"
          />
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <p className="text-h3 text-primary">Send an enquiry</p>
          </div>
          <div className="px-6 py-6">
            <EnquiryCard state="form" variant="sheet" values={FILLED} />
          </div>
        </div>
      </Specimen>
      <Text tone="muted">
        The sheet has the name, the phone and a shorter message box, with no email and no counter,
        as drawn. Closing it any way keeps what was typed until the page decides otherwise.
      </Text>
    </div>
  );
}

export function StickyMobileBarDemo() {
  const [pressed, setPressed] = useState(0);
  // The real bar is pinned to the bottom of a phone's screen and hidden from 1024 px; here it sits in
  // the page so it can be seen at every width.
  const SEEN = "static lg:flex";
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Signed out: a link, with the price per square foot" className={COLUMN}>
        <StickyMobileBar
          rupees={1_25_00_000}
          perSqftRupees={8_803}
          action={{ label: "Sign in to enquire", href: "#sign-in" }}
          className={`${SEEN} w-full`}
        />
      </Specimen>
      <Specimen label="Signed in: a button that opens the enquiry sheet" className={COLUMN}>
        <StickyMobileBar
          rupees={1_25_00_000}
          perSqftRupees={8_803}
          action={{ label: "Enquire", onClick: () => setPressed((count) => count + 1) }}
          className={`${SEEN} w-full`}
        />
      </Specimen>
      <Specimen label="Rent" className={COLUMN}>
        <StickyMobileBar
          rupees={48_000}
          listingType="rent"
          action={{ label: "Enquire", href: "#enquire" }}
          className={`${SEEN} w-full`}
        />
      </Specimen>
      <Specimen
        label="A narrow phone: the price is cut, the button keeps its size"
        className="w-full max-w-xs"
      >
        <StickyMobileBar
          rupees={12_75_00_000}
          perSqftRupees={18_803}
          action={{ label: "Sign in to enquire", href: "#sign-in" }}
          className={`${SEEN} w-full`}
        />
      </Specimen>
      <Text tone="muted">
        {pressed > 0 ? `Enquire pressed ${pressed} time(s). ` : ""}The real bar is pinned to the
        bottom of a phone&apos;s screen below 1024 px and the page draws it only when it should be
        there (not while the sheet is open, after sending, while loading or on not found). The page
        leaves room under its last section so the bar never hides content.
      </Text>
    </div>
  );
}
