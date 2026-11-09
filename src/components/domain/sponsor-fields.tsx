"use client";

/**
 * SponsorFields: the body of the admin's Add sponsor and Edit sponsor form: the advertiser's name, the alt text, the
 * destination link, the Active switch and the four banner picture slots.
 * Purpose: what the admin fills in to put a sponsor's banner on the public site (S7-T11, FR-ADM-11, DEC-15). Owner:
 *   design system. It holds no state: the page keeps the values, the errors and the files, and passes the words, already
 *   translated. It is made to sit in the manager drawer, whose footer has Cancel and Save sponsor.
 * Props: values ({ advertiser, alt, href, active }), errors (the message of each box with a problem, by box), onChange
 *   (the new values), slots (the four slots in the order of the screen, each the props of a SponsorImageSlot plus a key),
 *   disabled (while saving), words (labels, hints, placeholders, the Active line and the pictures' heading and notes),
 *   className.
 * Responsive: one column at every width, as the drawer is narrow; the slots stack one under the other.
 * Accessibility: every box has a visible label tied to it, with its hint and its error read with it; the Active
 *   switch's whole row is its click target and its line is read with it; the pictures are a named group.
 * States: new (every box empty), editing (filled), with errors on the boxes, with each slot in each of its states,
 *   saving (everything off).
 * Dependencies: FormField, Input, Label, Switch, SponsorImageSlot, Heading, cn. Tests: sponsor-parts.test.tsx; Design Lab
 *   "Sponsors" (S7-T11).
 * UX reference: admin-sponsors screen (the drawer: .form-grid, .tgl-row, .slots). The "Booking" line of the table is not
 *   a box here: the drawer has no field for it (ADR-104).
 */
import { useId } from "react";
import {
  SponsorImageSlot,
  type SponsorImageSlotProps,
} from "@/components/domain/sponsor-image-slot";
import { FormField } from "@/components/patterns/form-field";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

type SponsorFieldValues = {
  advertiser: string;
  alt: string;
  href: string;
  active: boolean;
};

type SponsorFieldName = "advertiser" | "alt" | "href";

type SponsorFieldErrors = Partial<Record<SponsorFieldName, string>>;

type SponsorFieldsWords = {
  advertiser: string;
  advertiserPlaceholder: string;
  alt: string;
  altPlaceholder: string;
  altHint: string;
  href: string;
  hrefPlaceholder: string;
  hrefHint: string;
  active: { label: string; hint: string };
  images: { title: string; text: string; closing: string };
};

type SponsorFieldsProps = {
  values: SponsorFieldValues;
  errors?: SponsorFieldErrors;
  onChange: (values: SponsorFieldValues) => void;
  slots: readonly (SponsorImageSlotProps & { key: string })[];
  disabled?: boolean;
  words: SponsorFieldsWords;
  className?: string;
};

const LIMITS = { advertiser: 80, alt: 200, href: 2000 };

function SponsorFields({
  values,
  errors = {},
  onChange,
  slots,
  disabled = false,
  words,
  className,
}: SponsorFieldsProps) {
  const base = useId();
  const switchId = `${base}-active`;
  const hintId = `${base}-active-hint`;
  const imagesId = `${base}-images`;
  const set = (patch: Partial<SponsorFieldValues>) => onChange({ ...values, ...patch });
  const problem = (name: SponsorFieldName) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };

  return (
    <div data-slot="sponsor-fields" className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-5">
        <FormField label={words.advertiser} required {...problem("advertiser")}>
          <Input
            value={values.advertiser}
            disabled={disabled}
            maxLength={LIMITS.advertiser}
            autoComplete="off"
            placeholder={words.advertiserPlaceholder}
            onChange={(event) => set({ advertiser: event.target.value })}
          />
        </FormField>
        <FormField label={words.alt} required hint={words.altHint} {...problem("alt")}>
          <Input
            value={values.alt}
            disabled={disabled}
            maxLength={LIMITS.alt}
            autoComplete="off"
            placeholder={words.altPlaceholder}
            onChange={(event) => set({ alt: event.target.value })}
          />
        </FormField>
        <FormField label={words.href} required hint={words.hrefHint} {...problem("href")}>
          <Input
            value={values.href}
            disabled={disabled}
            maxLength={LIMITS.href}
            inputMode="url"
            autoComplete="off"
            placeholder={words.hrefPlaceholder}
            onChange={(event) => set({ href: event.target.value })}
          />
        </FormField>
        <div className="flex items-center justify-between gap-4 py-1">
          <Label htmlFor={switchId} className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="font-bold text-ink">{words.active.label}</span>
            <span id={hintId} className="text-small font-normal text-muted">
              {words.active.hint}
            </span>
          </Label>
          <Switch
            id={switchId}
            aria-describedby={hintId}
            checked={values.active}
            disabled={disabled}
            onCheckedChange={(active) => set({ active })}
          />
        </div>
      </div>

      <section aria-labelledby={imagesId} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Heading as="h3" size="3" id={imagesId}>
            {words.images.title}
          </Heading>
          <p className="text-small text-muted">{words.images.text}</p>
        </div>
        <div className="flex flex-col gap-4">
          {slots.map(({ key, ...slot }) => (
            <SponsorImageSlot key={key} {...slot} disabled={disabled || slot.disabled === true} />
          ))}
        </div>
        <p className="text-caption text-muted">{words.images.closing}</p>
      </section>
    </div>
  );
}

export { SponsorFields };
export type {
  SponsorFieldErrors,
  SponsorFieldName,
  SponsorFieldValues,
  SponsorFieldsProps,
  SponsorFieldsWords,
};
