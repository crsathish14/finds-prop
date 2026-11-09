"use client";

import { useState, type ReactNode } from "react";
import {
  SponsorFields,
  type SponsorFieldErrors,
  type SponsorFieldValues,
  type SponsorFieldsWords,
} from "@/components/domain/sponsor-fields";
import {
  SponsorImageSlot,
  type SponsorImageSlotProps,
  type SponsorImageSlotState,
  type SponsorImageSlotWords,
} from "@/components/domain/sponsor-image-slot";
import { Specimen } from "../frame";

/**
 * The sponsor manager's form parts in their states (S7-T11, part B1): one picture slot in every state it can be in, and
 * the Add and Edit sponsor form with its four slots. Plain English text; nothing here is sent anywhere. The sample
 * pictures are the approved UX stand-ins (SVG, which the real form refuses). The words that are not in the approved
 * UX file are listed in ADR-105 for the owner to confirm.
 */

const ADS = "/design-lab/ads";

const WORDS: SponsorImageSlotWords = {
  dropTitle: "Drop an image here",
  dropText: "or choose a file",
  choose: "Choose file",
  replace: "Replace",
  remove: "Remove",
  chooseAnother: "Choose another file",
  keep: "Keep as is",
  checking: "Checking the picture",
  previewAlt: "Preview of the chosen picture",
};

type Where = {
  title: string;
  note: string;
  ratio: { width: number; height: number };
  sample: string;
};

const STRIP_DESKTOP: Where = {
  title: "Strip · desktop",
  note: "Shown at 970 × 90 · supply 1940 × 180",
  ratio: { width: 970, height: 90 },
  sample: `${ADS}/strip-970x90-a.svg`,
};
const STRIP_PHONE: Where = {
  title: "Strip · phone",
  note: "Shown at 320 × 100 · supply 640 × 200",
  ratio: { width: 320, height: 100 },
  sample: `${ADS}/strip-m-320x100-a.svg`,
};
const PANEL_DESKTOP: Where = {
  title: "Panel · desktop",
  note: "Shown at 524 × 494 · supply 1048 × 988",
  ratio: { width: 524, height: 494 },
  sample: `${ADS}/panel-524x494-a.svg`,
};
const PANEL_PHONE: Where = {
  title: "Panel · phone",
  note: "Shown at 640 × 320 · supply 1280 × 640",
  ratio: { width: 640, height: 320 },
  sample: `${ADS}/panel-m-640x320-a.svg`,
};

const NOTHING = () => undefined;

function slot(
  where: Where,
  state: SponsorImageSlotState,
  extra: Partial<SponsorImageSlotProps> = {},
): SponsorImageSlotProps {
  return {
    title: where.title,
    note: where.note,
    ratio: where.ratio,
    state,
    words: WORDS,
    onFile: NOTHING,
    ...(state === "filled" || state === "near" ? { image: { src: where.sample } } : {}),
    ...(state === "filled" ? { onRemove: NOTHING } : {}),
    ...(state === "near" ? { onKeep: NOTHING } : {}),
    ...extra,
  };
}

const fills = (size: string) => ({ title: "Fills the slot", text: size });

function Cell({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-130">{children}</div>;
}

/** A slot that takes a real file: any picture chosen shows as filled, with its own name. */
function ChoosableSlot() {
  const [picked, setPicked] = useState<{ name: string; url: string } | null>(null);
  return (
    <Cell>
      <SponsorImageSlot
        {...slot(STRIP_DESKTOP, picked ? "filled" : "empty", {
          ...(picked
            ? { image: { src: picked.url, alt: picked.name }, status: fills(picked.name) }
            : {}),
        })}
        onFile={(file) => {
          setPicked((previous) => {
            if (previous) URL.revokeObjectURL(previous.url);
            return { name: file.name, url: URL.createObjectURL(file) };
          });
        }}
        onRemove={() => setPicked(null)}
      />
    </Cell>
  );
}

export function SponsorSlotDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Empty: the whole picture box is the file picker (drop a file on it, press Enter or Space, or use the button)">
        <Cell>
          <SponsorImageSlot {...slot(STRIP_DESKTOP, "empty")} />
        </Cell>
      </Specimen>
      <Specimen label="Filled, in each of the four slots: the picture at the slot's true shape, 'Fills the slot' and its size and weight">
        <div className="grid w-full gap-4 md:grid-cols-2">
          <SponsorImageSlot
            {...slot(STRIP_DESKTOP, "filled", { status: fills("1940 × 180 · WEBP · 96 KB") })}
          />
          <SponsorImageSlot
            {...slot(STRIP_PHONE, "filled", { status: fills("640 × 200 · WEBP · 41 KB") })}
          />
          <SponsorImageSlot
            {...slot(PANEL_DESKTOP, "filled", { status: fills("1048 × 988 · WEBP · 118 KB") })}
          />
          <SponsorImageSlot
            {...slot(PANEL_PHONE, "filled", { status: fills("1280 × 640 · WEBP · 83 KB") })}
          />
        </div>
      </Specimen>
      <Specimen label="Near miss: 8 to 30 percent off the slot's shape, so it is shown whole on a plain background (accepted, with a notice)">
        <Cell>
          <SponsorImageSlot
            {...slot(STRIP_PHONE, "near", {
              image: { src: `${ADS}/near-miss-strip-970x120.svg` },
              status: {
                title: "Will be shown whole on a plain background",
                text: "The shape is 8 to 30 percent away from the slot, so we don't crop it. For the best result supply 640 × 200.",
              },
            })}
          />
        </Cell>
      </Specimen>
      <Specimen label="Refused, with the reason and what to do: wrong shape (the picture is shown so the person can see why)">
        <Cell>
          <SponsorImageSlot
            {...slot(STRIP_DESKTOP, "rejected", {
              image: { src: `${ADS}/near-miss-panel-524x600.svg` },
              status: {
                title: "Rejected: wrong shape",
                text: "This image is much taller than the slot (about 1 : 1.1, the slot is about 10.8 : 1). Supply a wide banner.",
              },
            })}
          />
        </Cell>
      </Specimen>
      <Specimen label="Refused: not a picture the site takes (the file name shows in the box), too small, too heavy">
        <div className="grid w-full gap-4 md:grid-cols-2">
          <SponsorImageSlot
            {...slot(STRIP_PHONE, "rejected", {
              fileName: "banner-mobile.svg",
              status: {
                title: "Rejected: SVG isn't accepted",
                text: "Upload a JPG, PNG or WEBP instead. SVG files can contain scripts.",
              },
            })}
          />
          <SponsorImageSlot
            {...slot(PANEL_PHONE, "rejected", {
              fileName: "small-banner.png · 300 × 150",
              status: {
                title: "Rejected: too small",
                text: "This is 300 × 150. Supply at least 1280 × 640 so it stays sharp on high-density screens.",
              },
            })}
          />
          <SponsorImageSlot
            {...slot(PANEL_DESKTOP, "rejected", {
              image: { src: `${ADS}/panel-524x494-b.svg` },
              status: {
                title: "Rejected: 412 KB is too large",
                text: "The limit is 150 KB. Compress the image and try again.",
              },
            })}
          />
        </div>
      </Specimen>
      <Specimen label="Checking: the file is being read and sent, so nothing in the slot can be pressed">
        <Cell>
          <SponsorImageSlot {...slot(STRIP_DESKTOP, "checking")} />
        </Cell>
      </Specimen>
      <Specimen label="Off while the sponsor is saving">
        <Cell>
          <SponsorImageSlot
            {...slot(STRIP_DESKTOP, "filled", {
              status: fills("1940 × 180 · WEBP · 96 KB"),
              disabled: true,
            })}
          />
        </Cell>
      </Specimen>
      <Specimen label="Try it: choose a picture from your computer (nothing is sent)">
        <ChoosableSlot />
      </Specimen>
    </div>
  );
}

const FIELD_WORDS: SponsorFieldsWords = {
  advertiser: "Advertiser name",
  advertiserPlaceholder: "Name shown to staff only",
  alt: "Alt text",
  altPlaceholder: "Describe the banner for screen readers",
  altHint: 'Read aloud by screen readers. Describe what the banner says, not just "banner".',
  href: "Destination link",
  hrefPlaceholder: "https://",
  hrefHint: "Opens in a new tab. Must start with https://.",
  active: { label: "Active", hint: "Inactive sponsors are never shown." },
  images: {
    title: "Banner images",
    text: "Finished images supplied by the advertiser. Supply each at twice the size for sharp screens. JPG, PNG or WEBP only, up to 150 KB each.",
    closing:
      "Supplying both the desktop and phone image of a format makes it ready. A sponsor with no ready format is never shown.",
  },
};

const FILLED: SponsorFieldValues = {
  advertiser: "Sample Developer",
  alt: "Sample Developer: new launch apartments in Velachery. Learn more.",
  href: "https://sampledeveloper.example/velachery",
  active: true,
};

const EMPTY: SponsorFieldValues = { advertiser: "", alt: "", href: "", active: true };

const allSlots = (
  state: (where: Where) => SponsorImageSlotProps,
): (SponsorImageSlotProps & { key: string })[] => [
  { key: "strip-desktop", ...state(STRIP_DESKTOP) },
  { key: "strip-phone", ...state(STRIP_PHONE) },
  { key: "panel-desktop", ...state(PANEL_DESKTOP) },
  { key: "panel-phone", ...state(PANEL_PHONE) },
];

const SIZES: Record<string, string> = {
  [STRIP_DESKTOP.title]: "1940 × 180 · WEBP · 96 KB",
  [STRIP_PHONE.title]: "640 × 200 · WEBP · 41 KB",
  [PANEL_DESKTOP.title]: "1048 × 988 · WEBP · 118 KB",
  [PANEL_PHONE.title]: "1280 × 640 · WEBP · 83 KB",
};

function FormState({
  initial,
  errors,
  slots,
  disabled = false,
}: {
  initial: SponsorFieldValues;
  errors?: SponsorFieldErrors;
  slots: (SponsorImageSlotProps & { key: string })[];
  disabled?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <div className="w-full max-w-170 rounded-xl border border-line bg-surface p-4 md:p-6">
      <SponsorFields
        values={values}
        {...(errors ? { errors } : {})}
        onChange={setValues}
        slots={slots}
        disabled={disabled}
        words={FIELD_WORDS}
      />
    </div>
  );
}

export function SponsorFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Add sponsor: every box empty and every slot waiting for a picture; Active starts on">
        <FormState initial={EMPTY} slots={allSlots((where) => slot(where, "empty"))} />
      </Specimen>
      <Specimen label="Edit sponsor: filled, all four slots ready (change a box, flip Active)">
        <FormState
          initial={FILLED}
          slots={allSlots((where) =>
            slot(where, "filled", { status: fills(SIZES[where.title] ?? "") }),
          )}
        />
      </Specimen>
      <Specimen label="Edit sponsor with a near-miss phone picture: it is accepted and shown whole, with a notice">
        <FormState
          initial={FILLED}
          slots={allSlots((where) =>
            where === STRIP_PHONE
              ? slot(where, "near", {
                  image: { src: `${ADS}/near-miss-strip-970x120.svg` },
                  status: {
                    title: "Will be shown whole on a plain background",
                    text: "The shape is 8 to 30 percent away from the slot, so we don't crop it. For the best result supply 640 × 200.",
                  },
                })
              : slot(where, "filled", { status: fills(SIZES[where.title] ?? "") }),
          )}
        />
      </Specimen>
      <Specimen label="Saved with problems: the boxes that need work are marked, and the refused pictures say why">
        <FormState
          initial={{
            advertiser: "",
            alt: "",
            href: "http://sampledeveloper.example",
            active: true,
          }}
          errors={{
            advertiser: "This field is required.",
            alt: "Add alt text so everyone can read the banner.",
            href: "The link must start with https://.",
          }}
          slots={allSlots((where) =>
            where === STRIP_DESKTOP
              ? slot(where, "rejected", {
                  image: { src: `${ADS}/near-miss-panel-524x600.svg` },
                  status: {
                    title: "Rejected: wrong shape",
                    text: "This image is much taller than the slot (about 1 : 1.1, the slot is about 10.8 : 1). Supply a wide banner.",
                  },
                })
              : where === STRIP_PHONE
                ? slot(where, "rejected", {
                    fileName: "banner-mobile.svg",
                    status: {
                      title: "Rejected: SVG isn't accepted",
                      text: "Upload a JPG, PNG or WEBP instead. SVG files can contain scripts.",
                    },
                  })
                : slot(where, "empty"),
          )}
        />
      </Specimen>
      <Specimen label="Saving: every box, the switch and every slot are off">
        <FormState
          initial={FILLED}
          disabled
          slots={allSlots((where) =>
            slot(where, "filled", { status: fills(SIZES[where.title] ?? "") }),
          )}
        />
      </Specimen>
    </div>
  );
}
