"use client";

/**
 * Sample steps of the post-property wizard, shared by the Seller board and its two whole-page previews.
 * They use the real parts (WizardShell, WizardFooter, ChoiceCards, AmenityChips, ReviewList, NextSteps) with
 * made-up words and no server. Nothing outside src/design-lab uses this file.
 */
import { useState, type ReactNode } from "react";
import { AmenityChips } from "@/components/domain/amenity-chips";
import { ChoiceCards } from "@/components/domain/choice-cards";
import { NextSteps } from "@/components/domain/next-steps";
import { ReviewList } from "@/components/domain/review-list";
import { WizardFooter } from "@/components/domain/wizard-footer";
import { WizardShell } from "@/components/domain/wizard-shell";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import type { Step } from "@/components/patterns/stepper";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const NOTHING = () => undefined;

const STEP_NAMES = [
  { label: "Basics", description: "Type, address" },
  { label: "Details", description: "Size, price, amenities" },
  { label: "Photos", description: "Up to 6 photos" },
  { label: "Description", description: "Title and details" },
  { label: "Review and submit", description: "Check everything" },
] as const;

export function stepsAt(current: 1 | 2 | 3 | 4 | 5, errorAt?: number): Step[] {
  return STEP_NAMES.map((step, index) => ({
    ...step,
    state:
      errorAt === index + 1
        ? "error"
        : index + 1 < current
          ? "done"
          : index + 1 === current
            ? "current"
            : "upcoming",
    ...(errorAt === index + 1 ? { stateLabel: "Needs attention" } : {}),
  }));
}

export const AMENITIES = [
  "Gym",
  "Swimming Pool",
  "24x7 Security",
  "Car Park",
  "Lift",
  "Power Backup",
  "Children Play Area",
  "Clubhouse",
  "Modular Kitchen",
  "Fully Furnished",
  "Near Metro",
  "Near Beach",
].map((label) => ({ value: label, label }));

/** The look of the footer on a board: in the flow, not fixed to the screen. */
export const INLINE_FOOTER =
  "static z-auto border-line bg-transparent px-0 pt-6 pb-0 shadow-none md:pt-6";
export const INLINE_SHELL = "pb-6 md:pb-6";

export function ListingTypeChoice({
  initial = "sale",
  error,
}: {
  initial?: string | null;
  error?: string;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ChoiceCards
      legend="I want to"
      name={`listing-type-${error ? "error" : "ok"}`}
      value={value}
      onChange={setValue}
      error={error}
      options={[
        { value: "sale", label: "Sell", hint: "List a home for sale" },
        { value: "rent", label: "Rent out", hint: "List a home for rent" },
      ]}
    />
  );
}

export function BasicsStep({ withErrors = false }: { withErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 text-primary">What are you listing?</h2>
        <p className="text-body text-muted">Start with the basics. You can change these later.</p>
      </div>
      <ListingTypeChoice />
      <FormField label="Property type">
        <NativeSelect defaultValue="apartment">
          <option value="apartment">Apartment</option>
          <option value="villa">Villa</option>
          <option value="house">Independent House</option>
          <option value="plot">Plot / Land</option>
          <option value="commercial">Commercial</option>
        </NativeSelect>
      </FormField>
      <FormField
        label="Address"
        required
        hint="Up to 300 characters."
        {...(withErrors ? { error: "Add the street or building." } : {})}
      >
        <Input defaultValue={withErrors ? "" : "12, Second Cross Street, Velachery"} />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Locality" required>
          <Input defaultValue="Velachery" />
        </FormField>
        <FormField label="City" required>
          <Input defaultValue="Chennai" />
        </FormField>
        <FormField label="State" hint="Tamil Nadu only for now.">
          <Input defaultValue="Tamil Nadu" readOnly />
        </FormField>
        <FormField
          label="Pincode"
          required
          {...(withErrors ? { error: "Enter the 6-digit pincode." } : {})}
        >
          <Input defaultValue={withErrors ? "6000" : "600042"} inputMode="numeric" maxLength={6} />
        </FormField>
      </div>
    </div>
  );
}

export function DetailsStep() {
  const [chosen, setChosen] = useState<string[]>(["Gym", "Lift", "Car Park"]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 text-primary">Tell us about the home</h2>
        <p className="text-body text-muted">Accurate size and price help buyers find it.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <FormField label="Bedrooms (BHK)">
          <NativeSelect defaultValue="3">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </NativeSelect>
        </FormField>
        <FormField label="Bathrooms">
          <NativeSelect defaultValue="2">
            <option value="1">1</option>
            <option value="2">2</option>
          </NativeSelect>
        </FormField>
        <FormField label="Area (sq.ft)">
          <Input defaultValue="1420" inputMode="numeric" />
        </FormField>
      </div>
      <FormField label="Price (₹)" hint="For rentals, enter the monthly rent.">
        <Input defaultValue="12500000" inputMode="numeric" />
      </FormField>
      <div className="flex flex-col gap-2">
        <span className="text-small font-semibold text-ink">Amenities (choose any)</span>
        <AmenityChips
          label="Amenities"
          options={AMENITIES}
          selected={chosen}
          onToggle={(value) =>
            setChosen((now) =>
              now.includes(value) ? now.filter((item) => item !== value) : [...now, value],
            )
          }
        />
      </div>
    </div>
  );
}

export function DescriptionStep() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 text-primary">Describe your home</h2>
        <p className="text-body text-muted">A clear title and a few sentences are enough.</p>
      </div>
      <FormField label="Title" required hint="8 to 140 characters. 52 / 140">
        <Input defaultValue="3 BHK apartment with clubhouse and covered parking" />
      </FormField>
      <FormField label="Description" optionalLabel="(optional)">
        <Textarea defaultValue="A bright east-facing apartment on a high floor in a gated community." />
      </FormField>
    </div>
  );
}

export function ReviewStep({ children }: { children?: ReactNode }) {
  const row = (id: string, label: string, value: ReactNode, editFor: string) => ({
    id,
    label,
    value,
    editText: "Edit",
    editFor,
    onEdit: NOTHING,
  });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 text-primary">Review and submit</h2>
        <p className="text-body text-muted">
          Check your details. You can go back to change anything.
        </p>
      </div>
      <ReviewList
        rows={[
          row("listing", "Listing", "For sale · Apartment", "listing"),
          row(
            "address",
            "Address",
            "12, Second Cross Street, Velachery, Chennai, Tamil Nadu 600042",
            "address",
          ),
          row("size", "Size", "3 BHK · 2 bath · 1,420 sq.ft", "size"),
          row("price", "Price", "₹1.25 Cr", "price"),
          row("photos", "Photos", "3 photos", "photos"),
          row("title", "Title", "3 BHK apartment with clubhouse and covered parking", "title"),
        ]}
      />
      <NextSteps title="What happens next">
        Your listing is saved as pending. It stays hidden until it is approved, then goes live. You
        can follow its status in My listings.
      </NextSteps>
      {children}
    </div>
  );
}

export function FailedAlert() {
  return (
    <Alert tone="danger" title="We couldn't submit your listing">
      Your answers are saved on this page. Check your connection and try again.
    </Alert>
  );
}

type ShellProps = {
  current: 1 | 2 | 3 | 4 | 5;
  errorAt?: number;
  /** On a board the footer sits in the flow; on a whole-page preview it is the real fixed bar. */
  inline?: boolean;
  alert?: ReactNode;
  submitting?: boolean;
  children: ReactNode;
};

export function SampleWizard({
  current,
  errorAt,
  inline = true,
  alert,
  submitting,
  children,
}: ShellProps) {
  const names = STEP_NAMES.map((step) => step.label);
  return (
    <WizardShell
      title="Post your property"
      emphasis="property"
      titleAs={inline ? "h2" : "h1"}
      titleId={inline ? `wizard-title-${current}-${errorAt ?? 0}` : "wizard-title"}
      description="Your listing is reviewed before it goes live. It takes about five minutes."
      steps={stepsAt(current, errorAt)}
      progressLabel={`Step ${current} of 5: ${names[current - 1]}`}
      className={inline ? INLINE_SHELL : ""}
      {...(alert ? { alert } : {})}
      footer={
        <WizardFooter
          className={inline ? INLINE_FOOTER : ""}
          {...(current > 1 ? { back: { label: "Back", onClick: NOTHING } } : {})}
          saveDraft={{ label: "Save draft", onClick: NOTHING }}
          next={
            current === 5
              ? {
                  label: submitting ? "Submitting" : "Submit for review",
                  onClick: NOTHING,
                  kind: "submit",
                  loading: submitting ?? false,
                }
              : { label: "Continue", onClick: NOTHING, kind: "continue" }
          }
        />
      }
    >
      {children}
    </WizardShell>
  );
}
