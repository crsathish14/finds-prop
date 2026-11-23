"use client";

import { useState } from "react";
import {
  SponsorAdFields,
  type SponsorAdFieldsWords,
  type SponsorAdValues,
} from "@/components/domain/sponsor-ad-fields";
import type { SponsorImageSlotProps } from "@/components/domain/sponsor-image-slot";
import { Specimen } from "../frame";

/**
 * The hero ad's part of the sponsor form (ADR-189): the brand, the photo and the Showcase and Cinematic words, empty and
 * filled, with problems, and with each style marked "Shown now". Plain English text; nothing here is sent anywhere. The
 * sample photo is a drawing, not a real project.
 */

const WORDS: SponsorAdFieldsWords = {
  title: "Hero ad",
  text: "What the ad under the search bar shows, in the style chosen above the list. Fill the boxes marked required for that style.",
  brand: "Developer or brand",
  brandHint: "Shown on the ad, up to 60 characters.",
  optional: "(optional)",
  shownNow: "Shown now",
  showcase: {
    title: "Showcase card",
    text: "The photo beside the project's details, with View project and Get price list.",
    boxes: {
      project: { label: "Project name" },
      locality: { label: "Area", placeholder: "Sholinganallur, OMR" },
      homes: { label: "Homes", placeholder: "2 & 3 BHK" },
      price: { label: "Price", placeholder: "₹78 L onwards" },
      size: { label: "Size", placeholder: "1,120 to 1,640 sq ft" },
      possession: { label: "Possession", placeholder: "Ready Dec 2027" },
      rera: { label: "RERA number" },
    },
  },
  cinematic: {
    title: "Cinematic banner",
    text: "A tall photo with a headline, one line and a button laid on it.",
    boxes: {
      headline: { label: "Headline" },
      button: { label: "Button words", placeholder: "Explore the project" },
      eyebrow: { label: "Small label above", placeholder: "New launch" },
      line: { label: "One line" },
    },
  },
};

const EMPTY: SponsorAdValues = {
  brand: "",
  showcase: { project: "", locality: "", homes: "", price: "", size: "", possession: "", rera: "" },
  cinematic: { headline: "", button: "", eyebrow: "", line: "" },
};

const FILLED: SponsorAdValues = {
  brand: "Sample Homes",
  showcase: {
    project: "Lakeview Residences",
    locality: "Sholinganallur, OMR",
    homes: "2 & 3 BHK",
    price: "₹78 L onwards",
    size: "1,120 to 1,640 sq ft",
    possession: "Ready Dec 2027",
    rera: "TN/00/SAMPLE/0000/2026",
  },
  cinematic: {
    headline: "Homes that open onto the lake",
    button: "Explore Lakeview",
    eyebrow: "New launch",
    line: "2 & 3 BHK from ₹78 L. Site visits every weekend.",
  },
};

const NOTHING = () => undefined;

const SLOT_WORDS = {
  dropTitle: "Drop an image here",
  dropText: "or choose a file",
  choose: "Choose file",
  replace: "Replace",
  remove: "Remove",
  chooseAnother: "Choose another",
  keep: "Keep it",
  checking: "Checking the picture",
  previewAlt: "Preview of the chosen picture",
};

const photo = (filled: boolean): SponsorImageSlotProps => ({
  title: "Photo",
  note: "Landscape, at least 1600 × 900 pixels, up to 480 KB. No words on it: the ad lays its own text on top.",
  ratio: { width: 16, height: 9 },
  state: filled ? "filled" : "empty",
  words: SLOT_WORDS,
  onFile: NOTHING,
  ...(filled
    ? {
        image: { src: "/design-lab/sponsor-photos/photo-a.svg" },
        status: { title: "Fills the slot", text: "2000 × 1125 · JPG · 320 KB" },
        onRemove: NOTHING,
      }
    : {}),
});

function Live({
  initial,
  filled,
  style,
  errors,
  disabled,
}: {
  initial: SponsorAdValues;
  filled: boolean;
  style: "showcase" | "cinematic";
  errors?: Partial<Record<string, string>>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <div className="w-full max-w-130">
      <SponsorAdFields
        values={values}
        onChange={setValues}
        photo={photo(filled)}
        style={style}
        words={WORDS}
        {...(errors ? { errors } : {})}
        {...(disabled ? { disabled } : {})}
      />
    </div>
  );
}

export function SponsorAdFieldsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="A new sponsor: nothing typed yet, the Showcase shown now">
        <Live initial={EMPTY} filled={false} style="showcase" />
      </Specimen>
      <Specimen label="Filled, with the photo; the Cinematic banner shown now">
        <Live initial={FILLED} filled style="cinematic" />
      </Specimen>
      <Specimen label="Problems on the boxes: a headline that is too long">
        <Live
          initial={{
            ...FILLED,
            cinematic: {
              ...FILLED.cinematic,
              headline: "Homes that open onto the lake and the sea",
            },
          }}
          filled
          style="cinematic"
          errors={{ "cinematic.headline": "This value is not valid." }}
        />
      </Specimen>
      <Specimen label="While saving: every box is off">
        <Live initial={FILLED} filled style="showcase" disabled />
      </Specimen>
    </div>
  );
}
