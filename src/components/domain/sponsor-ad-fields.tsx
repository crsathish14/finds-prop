"use client";

/**
 * SponsorAdFields: the hero ad's part of the admin's sponsor form: the brand, the one photo and the words of the two
 * styles, the Showcase card and the Cinematic banner (ADR-188).
 * Purpose: what the admin types and uploads for the hero ad under the search bar (sponsor ads plan, ADR-182). Owner:
 *   design system. It holds no state: the page keeps the values, the errors and the photo, and passes the words, already
 *   translated. It sits inside SponsorFields, between the Active switch and the banner pictures.
 * Props: values ({ brand, showcase: { project, locality, homes, size, possession, price, rera }, cinematic: { eyebrow,
 *   headline, line, button } }), errors (the message of each box with a problem, by "brand", "showcase.project" and so
 *   on), onChange (the new values), photo (the photo slot: the props of a SponsorImageSlot), style (the style the site
 *   shows now, marked "Shown now"), disabled (while saving), words (headings, labels, hints and the "Shown now" badge),
 *   className.
 * Responsive: one column in the narrow drawer; the short Showcase and Cinematic boxes pair up from 768 px.
 * Accessibility: each style is a named group with its heading; every box has a visible label, its hint and its error;
 *   the required boxes of each style are marked, as an ad shows only once they are filled.
 * States: empty, filled, with errors, the Showcase or the Cinematic style shown now, saving (everything off).
 * Dependencies: FormField, Input, SponsorImageSlot, Badge, Heading, cn. Tests: sponsor-parts.test.tsx; Design Lab
 *   "Sponsors" (Hero ad fields).
 * UX reference: none in the approved UX; the owner's sponsor concepts of 23 Nov 2026 (A and B) and decisions on the
 *   admin's data (ADR-182).
 */
import { useId, type ReactNode } from "react";
import {
  SponsorImageSlot,
  type SponsorImageSlotProps,
} from "@/components/domain/sponsor-image-slot";
import { FormField } from "@/components/patterns/form-field";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const SHOWCASE = [
  { box: "project", max: 60, required: true },
  { box: "locality", max: 60, required: true },
  { box: "homes", max: 40, required: true },
  { box: "price", max: 40, required: true },
  { box: "size", max: 40, required: false },
  { box: "possession", max: 40, required: false },
  { box: "rera", max: 60, required: false },
] as const;

const CINEMATIC = [
  { box: "headline", max: 40, required: true },
  { box: "button", max: 24, required: true },
  { box: "eyebrow", max: 30, required: false },
  { box: "line", max: 90, required: false },
] as const;

type ShowcaseBox = (typeof SHOWCASE)[number]["box"];
type CinematicBox = (typeof CINEMATIC)[number]["box"];

type SponsorAdValues = {
  brand: string;
  showcase: Record<ShowcaseBox, string>;
  cinematic: Record<CinematicBox, string>;
};

type BoxWords = { label: string; placeholder?: string };

type SponsorAdFieldsWords = {
  title: string;
  text: string;
  brand: string;
  brandHint: string;
  /** "(optional)". */
  optional: string;
  /** The badge on the style the site shows now. */
  shownNow: string;
  showcase: { title: string; text: string; boxes: Record<ShowcaseBox, BoxWords> };
  cinematic: { title: string; text: string; boxes: Record<CinematicBox, BoxWords> };
};

type SponsorAdFieldsProps = {
  values: SponsorAdValues;
  errors?: Partial<Record<string, string>>;
  onChange: (values: SponsorAdValues) => void;
  photo: SponsorImageSlotProps;
  style: "showcase" | "cinematic";
  disabled?: boolean;
  words: SponsorAdFieldsWords;
  className?: string;
};

function SponsorAdFields({
  values,
  errors = {},
  onChange,
  photo,
  style,
  disabled = false,
  words,
  className,
}: SponsorAdFieldsProps) {
  const base = useId();
  const sectionId = `${base}-ad`;
  const showcaseId = `${base}-showcase`;
  const cinematicId = `${base}-cinematic`;
  const problem = (name: string) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };

  const group = (
    id: string,
    kind: "showcase" | "cinematic",
    heading: { title: string; text: string },
    children: ReactNode,
  ) => (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 id={id} className="text-title text-ink">
            {heading.title}
          </h4>
          {style === kind ? <Badge tone="success">{words.shownNow}</Badge> : null}
        </div>
        <p className="text-small text-muted">{heading.text}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );

  return (
    <section
      data-slot="sponsor-ad-fields"
      aria-labelledby={sectionId}
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex flex-col gap-1">
        <Heading as="h3" size="3" id={sectionId}>
          {words.title}
        </Heading>
        <p className="text-small text-muted">{words.text}</p>
      </div>
      <FormField label={words.brand} hint={words.brandHint} {...problem("brand")}>
        <Input
          value={values.brand}
          disabled={disabled}
          maxLength={60}
          autoComplete="off"
          onChange={(event) => onChange({ ...values, brand: event.target.value })}
        />
      </FormField>
      <SponsorImageSlot {...photo} disabled={disabled || photo.disabled === true} />
      {group(
        showcaseId,
        "showcase",
        words.showcase,
        SHOWCASE.map(({ box, max, required }) => (
          <FormField
            key={box}
            label={words.showcase.boxes[box].label}
            {...(required ? { required: true } : { optionalLabel: words.optional })}
            {...problem(`showcase.${box}`)}
          >
            <Input
              value={values.showcase[box]}
              disabled={disabled}
              maxLength={max}
              autoComplete="off"
              {...(words.showcase.boxes[box].placeholder
                ? { placeholder: words.showcase.boxes[box].placeholder }
                : {})}
              onChange={(event) =>
                onChange({ ...values, showcase: { ...values.showcase, [box]: event.target.value } })
              }
            />
          </FormField>
        )),
      )}
      {group(
        cinematicId,
        "cinematic",
        words.cinematic,
        CINEMATIC.map(({ box, max, required }) => (
          <FormField
            key={box}
            label={words.cinematic.boxes[box].label}
            {...(required ? { required: true } : { optionalLabel: words.optional })}
            {...problem(`cinematic.${box}`)}
          >
            <Input
              value={values.cinematic[box]}
              disabled={disabled}
              maxLength={max}
              autoComplete="off"
              {...(words.cinematic.boxes[box].placeholder
                ? { placeholder: words.cinematic.boxes[box].placeholder }
                : {})}
              onChange={(event) =>
                onChange({
                  ...values,
                  cinematic: { ...values.cinematic, [box]: event.target.value },
                })
              }
            />
          </FormField>
        )),
      )}
    </section>
  );
}

export { SponsorAdFields };
export type { SponsorAdFieldsProps, SponsorAdFieldsWords, SponsorAdValues };
