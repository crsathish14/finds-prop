"use client";

import { Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { AmenityChips } from "@/components/domain/amenity-chips";
import { DraftsList, type DraftItem } from "@/components/domain/drafts-list";
import { GateCard } from "@/components/domain/gate-card";
import { NextSteps } from "@/components/domain/next-steps";
import { ReviewList } from "@/components/domain/review-list";
import { WizardFooter } from "@/components/domain/wizard-footer";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { DeviceFrame, Specimen, Stage } from "../frame";
import {
  AMENITIES,
  BasicsStep,
  DescriptionStep,
  DetailsStep,
  FailedAlert,
  INLINE_FOOTER,
  ListingTypeChoice,
  ReviewStep,
  SampleWizard,
} from "./seller-parts";

const NOTHING = () => undefined;

export function WizardShellDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Step 1, Basics" className="w-full">
        <Stage tone="canvas" className="w-full p-0">
          <SampleWizard current={1}>
            <BasicsStep />
          </SampleWizard>
        </Stage>
      </Specimen>
      <Specimen
        label="Step 1 with two fields to fix: the step is marked, Continue stays"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full p-0">
          <SampleWizard current={1} errorAt={1}>
            <BasicsStep withErrors />
          </SampleWizard>
        </Stage>
      </Specimen>
      <Specimen label="Step 2, Details" className="w-full">
        <Stage tone="canvas" className="w-full p-0">
          <SampleWizard current={2}>
            <DetailsStep />
          </SampleWizard>
        </Stage>
      </Specimen>
      <Specimen label="Step 4, Description" className="w-full">
        <Stage tone="canvas" className="w-full p-0">
          <SampleWizard current={4}>
            <DescriptionStep />
          </SampleWizard>
        </Stage>
      </Specimen>
      <Specimen label="Step 5, Review, when sending failed: the answers stay" className="w-full">
        <Stage tone="canvas" className="w-full p-0">
          <SampleWizard current={5} alert={<FailedAlert />}>
            <ReviewStep />
          </SampleWizard>
        </Stage>
      </Specimen>
      <Specimen label="On a phone the footer is fixed to the bottom of the screen (whole-page previews)">
        <div className="flex flex-wrap items-start gap-6">
          <DeviceFrame preview="wizard-basics" size="phone" />
          <DeviceFrame preview="wizard-review" size="phone" />
        </div>
      </Specimen>
    </div>
  );
}

export function WizardFooterDemo() {
  const specimens: { label: string; node: React.ReactNode }[] = [
    {
      label: "First step: no Back",
      node: (
        <WizardFooter
          className={INLINE_FOOTER}
          saveDraft={{ label: "Save draft", onClick: NOTHING }}
          next={{ label: "Continue", onClick: NOTHING, kind: "continue" }}
        />
      ),
    },
    {
      label: "A middle step",
      node: (
        <WizardFooter
          className={INLINE_FOOTER}
          back={{ label: "Back", onClick: NOTHING }}
          saveDraft={{ label: "Save draft", onClick: NOTHING }}
          next={{ label: "Continue", onClick: NOTHING, kind: "continue" }}
        />
      ),
    },
    {
      label: "Last step: the one copper button",
      node: (
        <WizardFooter
          className={INLINE_FOOTER}
          back={{ label: "Back", onClick: NOTHING }}
          saveDraft={{ label: "Save draft", onClick: NOTHING }}
          next={{ label: "Submit for review", onClick: NOTHING, kind: "submit" }}
        />
      ),
    },
    {
      label: "Submitting: the label holds, clicks are ignored",
      node: (
        <WizardFooter
          className={INLINE_FOOTER}
          back={{ label: "Back", onClick: NOTHING, disabled: true }}
          saveDraft={{ label: "Save draft", onClick: NOTHING, disabled: true }}
          next={{ label: "Submitting", onClick: NOTHING, kind: "submit", loading: true }}
        />
      ),
    },
    {
      label: "Waiting for a photo: Continue is off",
      node: (
        <WizardFooter
          className={INLINE_FOOTER}
          back={{ label: "Back", onClick: NOTHING }}
          saveDraft={{ label: "Save draft", onClick: NOTHING }}
          next={{ label: "Continue", onClick: NOTHING, kind: "continue", disabled: true }}
        />
      ),
    },
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {specimens.map((item) => (
        <Specimen key={item.label} label={item.label} className="w-full">
          <Stage className="w-full">{item.node}</Stage>
        </Specimen>
      ))}
    </div>
  );
}

export function ChoiceCardsDemo() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Specimen label="Nothing chosen yet" className="w-full">
        <Stage className="w-full">
          <ListingTypeChoice initial={null} />
        </Stage>
      </Specimen>
      <Specimen
        label="Sell chosen (the tick means it is not shown by colour alone)"
        className="w-full"
      >
        <Stage className="w-full">
          <ListingTypeChoice initial="sale" />
        </Stage>
      </Specimen>
      <Specimen label="Error" className="w-full">
        <Stage className="w-full">
          <ListingTypeChoice initial={null} error="This field is required." />
        </Stage>
      </Specimen>
    </div>
  );
}

export function AmenityChipsDemo() {
  const [some, setSome] = useState<string[]>(["Gym", "Lift", "Car Park"]);
  const toggle = (value: string) =>
    setSome((now) =>
      now.includes(value) ? now.filter((item) => item !== value) : [...now, value],
    );
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Specimen label="Three chosen (click to change)" className="w-full">
        <Stage className="w-full">
          <AmenityChips
            label="Amenities, some"
            options={AMENITIES}
            selected={some}
            onToggle={toggle}
          />
        </Stage>
      </Specimen>
      <Specimen label="None chosen" className="w-full">
        <Stage className="w-full">
          <AmenityChips
            label="Amenities, none"
            options={AMENITIES}
            selected={[]}
            onToggle={NOTHING}
          />
        </Stage>
      </Specimen>
      <Specimen label="Disabled while a draft is saving" className="w-full">
        <Stage className="w-full">
          <AmenityChips
            label="Amenities, disabled"
            options={AMENITIES}
            selected={["Gym"]}
            onToggle={NOTHING}
            disabled
          />
        </Stage>
      </Specimen>
    </div>
  );
}

export function ReviewListDemo() {
  const row = (id: string, label: string, value: React.ReactNode, editFor: string) => ({
    id,
    label,
    value,
    editText: "Edit",
    editFor,
    onEdit: NOTHING,
  });
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Specimen label="Rows with Edit" className="w-full">
        <Stage className="w-full">
          <ReviewList
            rows={[
              row("a", "Listing", "For sale · Apartment", "listing"),
              row("b", "Size", "3 BHK · 2 bath · 1,420 sq.ft", "size"),
              row("c", "Price", "₹1.25 Cr", "price"),
            ]}
          />
        </Stage>
      </Specimen>
      <Specimen label="A long address wraps; an empty answer shows a dash" className="w-full">
        <Stage className="w-full">
          <ReviewList
            rows={[
              row(
                "a",
                "Address",
                "Flat 4B, Sri Venkateswara Residency, 12th Cross Street, Off Velachery Main Road, Near Phoenix Marketcity, Velachery, Chennai, Tamil Nadu 600042",
                "address",
              ),
              row("b", "Description", "", "description"),
            ]}
          />
        </Stage>
      </Specimen>
    </div>
  );
}

export function NextStepsDemo() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Specimen label="What happens next" className="w-full">
        <NextSteps title="What happens next">
          Your listing is saved as pending. It stays hidden until it is approved, then goes live.
          You can follow its status in My listings.
        </NextSteps>
      </Specimen>
      <Specimen label="A longer sentence" className="w-full">
        <NextSteps title="What happens next">
          Your listing is saved as pending and stays hidden until an admin approves it. If something
          needs changing, the reason is shown in My listings and you can edit and send it again.
          Most listings are reviewed within a day.
        </NextSteps>
      </Specimen>
    </div>
  );
}

export function GateCardDemo() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Specimen label="Ask" className="w-full">
        <Stage tone="canvas" className="w-full">
          <GateCard
            as="h3"
            icon={Mail}
            title="Verify your email to post a property"
            description="We use it to tell you when your listing is reviewed and to keep your account safe. It takes a minute."
            note="Nothing you've entered is lost. You'll come back to this step of your listing."
            footer={<Link href="#browse">Not now, back to browsing</Link>}
          >
            <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
              <FormField label="Email address">
                <Input type="email" defaultValue="priya.raman@example.com" />
              </FormField>
              <Button variant="accent" size="lg" className="w-full">
                Send verification link
              </Button>
            </form>
          </GateCard>
        </Stage>
      </Specimen>
      <Specimen label="Sent (a status line, read aloud when it appears)" className="w-full">
        <Stage tone="canvas" className="w-full">
          <GateCard
            as="h3"
            status
            tone="success"
            icon={MailCheck}
            title="Check your email"
            description="We sent a link to priya.raman@example.com. Open it, then come back here to keep going."
            note="Your draft is saved. You can close this tab and return later."
          />
        </Stage>
      </Specimen>
    </div>
  );
}

const DRAFTS: DraftItem[] = [
  {
    id: "a",
    title: "3 BHK apartment with clubhouse and covered parking",
    meta: "For sale · Apartment · Velachery",
    updated: "Saved 7 Nov",
    continueHref: "#a",
    continueText: "Continue",
    continueFor: "3 BHK apartment with clubhouse and covered parking",
    deleteText: "Delete",
    deleteFor: "3 BHK apartment with clubhouse and covered parking",
    onDelete: NOTHING,
  },
  {
    id: "b",
    title: "Untitled draft",
    meta: "For rent · Villa",
    updated: "Saved 5 Nov",
    continueHref: "#b",
    continueText: "Continue",
    continueFor: "Untitled draft",
    deleteText: "Delete",
    deleteFor: "Untitled draft",
    onDelete: NOTHING,
  },
];

const LONG_DRAFT: DraftItem = {
  id: "long",
  title: "3 BHK apartment with clubhouse and covered parking",
  meta: "For sale · Apartment · Velachery",
  updated: "Saved 7 Nov",
  continueHref: "#long",
  continueText: "Continue",
  continueFor: "a very long draft",
  deleteText: "Delete",
  deleteFor: "a very long draft",
  onDelete: NOTHING,
};

export function DraftsListDemo() {
  const [items, setItems] = useState(DRAFTS);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Specimen label="Two drafts (Delete removes the row here)" className="w-full">
        <Stage tone="canvas" className="w-full">
          <DraftsList
            heading="Your drafts"
            headingAs="h3"
            items={items.map((item) => ({
              ...item,
              onDelete: () => setItems((now) => now.filter((other) => other.id !== item.id)),
            }))}
          />
        </Stage>
      </Specimen>
      <Specimen
        label="A very long title is cut after two lines; one draft is being deleted"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <DraftsList
            heading="Your drafts"
            headingAs="h3"
            items={[
              {
                ...LONG_DRAFT,
                title:
                  "Spacious three bedroom apartment with a large east facing balcony, clubhouse, swimming pool, covered parking for two cars and twenty four hour security in a gated community near the metro",
                pending: true,
              },
            ]}
          />
        </Stage>
      </Specimen>
    </div>
  );
}
